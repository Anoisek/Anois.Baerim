// Discord slash-command endpoint for Ore Finder ("multi-server" support).
// Runs entirely as one stateless HTTP request per interaction - Discord POSTs
// here directly, no Gateway/WebSocket connection needed, so it fits the
// Worker's request/response model with no extra infrastructure.
//
// /orefinder-here sets the invoking channel as an alert destination for that
// guild; /orefinder-role sets which role gets pinged there; /orefinder-addmap
// and /orefinder-removemap toggle per-map opt-out (every map is included by
// default). All four require the "Manage Server" permission (enforced by
// Discord itself via each command's default_member_permissions at
// registration time - see registerOreFinderCommands).

const MANAGE_GUILD = 0x20n
const ROLE_OPTION_TYPE = 8
const STRING_OPTION_TYPE = 3
const ORE_MAP_NAMES = ['Yongan', 'Joan', 'Pyungmoo']
const MAP_CHOICES = ORE_MAP_NAMES.map(name => ({ name, value: name }))

function parseExcludedMaps(raw) {
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter(m => ORE_MAP_NAMES.includes(m)) : []
  } catch {
    return []
  }
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

async function verifySignature(env, body, signature, timestamp) {
  if (!env.ORE_FINDER_DISCORD_PUBLIC_KEY || !signature || !timestamp) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(env.ORE_FINDER_DISCORD_PUBLIC_KEY),
      { name: 'Ed25519' },
      false,
      ['verify']
    )
    const data = new TextEncoder().encode(timestamp + body)
    return await crypto.subtle.verify('Ed25519', key, hexToBytes(signature), data)
  } catch {
    return false
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) })
}

function ephemeral(content, headers) {
  return json({ type: 4, data: { content, flags: 64 } }, 200, headers)
}

async function handleDiscordInteractions(request, env, headers) {
  const signature = request.headers.get('X-Signature-Ed25519')
  const timestamp = request.headers.get('X-Signature-Timestamp')
  const body = await request.text()

  if (!(await verifySignature(env, body, signature, timestamp))) {
    return json({ error: 'invalid signature' }, 401, headers)
  }

  const interaction = JSON.parse(body)

  if (interaction.type === 1) return json({ type: 1 }, 200, headers)

  if (interaction.type !== 2) return json({ error: 'unknown interaction type' }, 400, headers)

  const guildId = interaction.guild_id
  if (!guildId) return ephemeral('This command only works on a Discord server, not in DMs.', headers)

  const name = interaction.data?.name
  const nowIso = new Date().toISOString()

  if (name === 'orefinder-here') {
    const channelId = interaction.channel_id
    await env.DB.prepare(
      'INSERT INTO ore_finder_discord_configs (guild_id, channel_id, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, updated_at = excluded.updated_at'
    ).bind(guildId, channelId, nowIso).run()
    return ephemeral(`✅ Ore Finder alerts will be sent to <#${channelId}>.`, headers)
  }

  if (name === 'orefinder-role') {
    const roleId = interaction.data?.options?.find(o => o.name === 'role')?.value
    if (!roleId) return ephemeral('No role provided.', headers)
    const existing = await env.DB.prepare('SELECT guild_id FROM ore_finder_discord_configs WHERE guild_id = ?').bind(guildId).first()
    if (!existing) return ephemeral('Set a channel first with /orefinder-here.', headers)
    await env.DB.prepare('UPDATE ore_finder_discord_configs SET role_id = ?, updated_at = ? WHERE guild_id = ?')
      .bind(roleId, nowIso, guildId).run()
    return ephemeral(`✅ Ore Finder alerts will mention <@&${roleId}>.`, headers)
  }

  if (name === 'orefinder-addmap' || name === 'orefinder-removemap') {
    const mapName = interaction.data?.options?.find(o => o.name === 'map')?.value
    if (!ORE_MAP_NAMES.includes(mapName)) return ephemeral('Unknown map.', headers)

    const row = await env.DB.prepare('SELECT excluded_maps FROM ore_finder_discord_configs WHERE guild_id = ?').bind(guildId).first()
    if (!row) return ephemeral('Set a channel first with /orefinder-here.', headers)

    const excluded = parseExcludedMaps(row.excluded_maps)

    if (name === 'orefinder-removemap') {
      if (excluded.includes(mapName)) return ephemeral(`You are already not receiving alerts for **${mapName}**.`, headers)
      excluded.push(mapName)
      await env.DB.prepare('UPDATE ore_finder_discord_configs SET excluded_maps = ?, updated_at = ? WHERE guild_id = ?')
        .bind(JSON.stringify(excluded), nowIso, guildId).run()
      return ephemeral(`✅ You will no longer receive alerts for **${mapName}**.`, headers)
    }

    if (!excluded.includes(mapName)) return ephemeral(`You are already receiving alerts for **${mapName}**.`, headers)
    const next = excluded.filter(m => m !== mapName)
    await env.DB.prepare('UPDATE ore_finder_discord_configs SET excluded_maps = ?, updated_at = ? WHERE guild_id = ?')
      .bind(next.length > 0 ? JSON.stringify(next) : null, nowIso, guildId).run()
    return ephemeral(`✅ You will now receive alerts for **${mapName}**.`, headers)
  }

  return json({ error: 'unknown command' }, 400, headers)
}

// One-off (re-runnable) command registration - PUTs the global command list
// to Discord. Not called automatically; hit POST /discord/register-commands
// (admin-only) once after deploying, and again any time the command
// definitions below change.
async function registerOreFinderCommands(env) {
  if (!env.ORE_FINDER_DISCORD_BOT_TOKEN || !env.ORE_FINDER_DISCORD_APPLICATION_ID) {
    throw new Error('ORE_FINDER_DISCORD_BOT_TOKEN / ORE_FINDER_DISCORD_APPLICATION_ID not set')
  }

  const commands = [
    {
      name: 'orefinder-here',
      description: 'Set this channel as the Ore Finder alert destination',
      default_member_permissions: String(MANAGE_GUILD),
      dm_permission: false,
    },
    {
      name: 'orefinder-role',
      description: 'Set which role gets pinged on Ore Finder alerts',
      default_member_permissions: String(MANAGE_GUILD),
      dm_permission: false,
      options: [
        { type: ROLE_OPTION_TYPE, name: 'role', description: 'Role to mention', required: true },
      ],
    },
    {
      name: 'orefinder-addmap',
      description: 'Resume Ore Finder alerts for a map you previously removed',
      default_member_permissions: String(MANAGE_GUILD),
      dm_permission: false,
      options: [
        { type: STRING_OPTION_TYPE, name: 'map', description: 'Map to resume alerts for', required: true, choices: MAP_CHOICES },
      ],
    },
    {
      name: 'orefinder-removemap',
      description: 'Stop Ore Finder alerts for one map (every map is included by default)',
      default_member_permissions: String(MANAGE_GUILD),
      dm_permission: false,
      options: [
        { type: STRING_OPTION_TYPE, name: 'map', description: 'Map to stop alerts for', required: true, choices: MAP_CHOICES },
      ],
    },
  ]

  const res = await fetch(`https://discord.com/api/v10/applications/${env.ORE_FINDER_DISCORD_APPLICATION_ID}/commands`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.ORE_FINDER_DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Discord command registration failed: ${res.status} ${text}`)
  return JSON.parse(text)
}

export { handleDiscordInteractions, registerOreFinderCommands }
