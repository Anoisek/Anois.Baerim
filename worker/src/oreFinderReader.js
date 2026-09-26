import { isOreAddWindowOpen } from './db.js'
import { matchZone, zoneHelp } from './oreFinderZoneAlert.js'

// Ore Finder channel reader - an extra, independent feature on top of the
// existing Ore Finder bot (alerts and the other slash commands are untouched).
//
// Channels are set up with /orefinder-reportmap <map>: each takes reports for
// one map, made by mentioning the bot with the coordinates ("@Ore Finder 512
// 734") or with the name of one of the admin's circles ("@Ore Finder bio" ->
// zone alert with that circle, see oreFinderZoneAlert.js). A Cron Trigger fires every minute; inside the same windows in which
// ores can be reported on the website (xx:58-xx:09 and xx:28-xx:39,
// isOreAddWindowOpen in db.js) it reads those channels twice per minute (at
// :00 and ~:30) over Discord's REST API - no Gateway connection. From each
// channel only the newest message that mentions the bot is taken. Messages
// that mention the bot always include their text, so the privileged Message
// Content Intent isn't needed.
//
// Batching: a Workers Free invocation may make only 50 external subrequests,
// so channels are split into batches of BATCH_SIZE and each batch is handled
// in its own invocation of this same Worker (via the SELF service binding),
// each with its own 50-subrequest budget. One request can fan out to at most
// 32 invocations, and there are two rounds per minute, so up to 16 batches
// (~320 channels) fit before this needs to change.
//
// ORE_FINDER_READER_ENABLED ("1" = on) turns it on/off. Test mode:
// ORE_FINDER_READER_TEST_CHANNEL_ID reads only that channel, around the
// clock (windows ignored). Dry run: ORE_FINDER_READER_DRY_RUN = "1" only
// replies with what would be reported - nothing is written to the Ore Finder.

const BATCH_SIZE = 20 // 2 subrequests per channel (read + reply) → 40 of the 50 allowed
const MAX_BATCHES_PER_ROUND = 16
const SECOND_ROUND_DELAY_MS = 30_000
const CONCURRENCY = 5 // Workers allow 6 simultaneous outgoing connections
const DISCORD_API = 'https://discord.com/api/v10'
const MAP_COLORS = { Yongan: 'red', Joan: 'yellow', Pyungmoo: 'blue' }

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  })
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

// Discord snowflakes are 64-bit - compare as BigInt, never as numbers.
const newerId = (a, b) => (BigInt(a) > BigInt(b) ? a : b)
const mapLabel = name => `${name} (${MAP_COLORS[name] || name})`

// Channels set up with /orefinder-reportmap (test mode: just the test channel).
async function readerChannels(env) {
  const testId = env.ORE_FINDER_READER_TEST_CHANNEL_ID
  const rows = testId
    ? await env.DB.prepare('SELECT channel_id, guild_id, map FROM ore_finder_report_channels WHERE channel_id = ?').bind(testId).all()
    : await env.DB.prepare('SELECT channel_id, guild_id, map FROM ore_finder_report_channels').all()
  const channels = rows.results.map(r => ({ channelId: r.channel_id, guildId: r.guild_id, map: r.map }))
  if (testId && channels.length === 0) channels.push({ channelId: testId, guildId: null, map: null })
  return channels
}

async function dispatchRound(env) {
  const channels = await readerChannels(env)
  const batches = chunk(channels, BATCH_SIZE).slice(0, MAX_BATCHES_PER_ROUND)
  if (channels.length > BATCH_SIZE * MAX_BATCHES_PER_ROUND) {
    console.log('ore finder reader: too many channels for one round, some skipped', channels.length)
  }
  await Promise.all(batches.map(batch =>
    env.SELF.fetch('https://internal/discord/read-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': env.AUTH_SECRET },
      body: JSON.stringify({ channels: batch }),
    }).catch(err => console.log('ore finder reader: batch dispatch failed', err && err.message))
  ))
}

// Cron entry point.
export async function runOreFinderReader(env) {
  if (env.ORE_FINDER_READER_ENABLED !== '1' || !env.ORE_FINDER_DISCORD_BOT_TOKEN) return
  if (!env.ORE_FINDER_READER_TEST_CHANNEL_ID && !isOreAddWindowOpen(new Date())) return
  await dispatchRound(env)
  await sleep(SECOND_ROUND_DELAY_MS)
  await dispatchRound(env)
}

// Internal endpoint: one batch of channels, in its own invocation.
export async function handleReadBatch(request, env, headers) {
  if (!env.AUTH_SECRET || request.headers.get('X-Internal-Key') !== env.AUTH_SECRET) {
    return json({ error: 'forbidden' }, 403, headers)
  }
  const body = await request.json().catch(() => null)
  const channels = Array.isArray(body?.channels) ? body.channels : []
  const results = await readChannels(env, channels)
  return json({ ok: true, results }, 200, headers)
}

async function readChannels(env, channels) {
  if (channels.length === 0) return []
  const ids = channels.map(c => c.channelId)
  const placeholders = ids.map(() => '?').join(',')
  const cursorRows = await env.DB.prepare(
    `SELECT channel_id, last_message_id FROM ore_finder_read_cursors WHERE channel_id IN (${placeholders})`
  ).bind(...ids).all()
  const cursors = Object.fromEntries(cursorRows.results.map(r => [r.channel_id, r.last_message_id]))

  const results = []
  for (const group of chunk(channels, CONCURRENCY)) {
    results.push(...await Promise.all(group.map(c => readChannel(env, c, cursors[c.channelId]))))
  }
  return results
}

async function readChannel(env, channel, lastId) {
  try {
    // First time a channel is seen: only remember where it currently ends, so
    // old history is never processed.
    const url = lastId
      ? `${DISCORD_API}/channels/${channel.channelId}/messages?after=${lastId}&limit=100`
      : `${DISCORD_API}/channels/${channel.channelId}/messages?limit=1`
    const res = await fetch(url, { headers: { Authorization: `Bot ${env.ORE_FINDER_DISCORD_BOT_TOKEN}` } })
    if (!res.ok) return { channelId: channel.channelId, error: res.status }

    const messages = await res.json()
    if (messages.length === 0) return { channelId: channel.channelId, read: 0 }

    const newest = messages.reduce((id, m) => newerId(id, m.id), messages[0].id)
    await env.DB.prepare(
      'INSERT INTO ore_finder_read_cursors (channel_id, last_message_id, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(channel_id) DO UPDATE SET last_message_id = excluded.last_message_id, updated_at = excluded.updated_at'
    ).bind(channel.channelId, newest, new Date().toISOString()).run()
    if (!lastId) return { channelId: channel.channelId, read: 0 }

    const report = latestMention(env, messages)
    if (report) await handleReport(env, channel, report)
    return { channelId: channel.channelId, read: messages.length, report: report ? report.id : null }
  } catch (err) {
    return { channelId: channel.channelId, error: (err && err.message) || 'failed' }
  }
}

// Newest message that mentions the bot (and isn't from a bot).
function latestMention(env, messages) {
  const botId = env.ORE_FINDER_DISCORD_APPLICATION_ID
  let latest = null
  for (const m of messages) {
    if (m.author?.bot) continue
    if (!(m.mentions ?? []).some(u => u.id === botId)) continue
    if (!latest || BigInt(m.id) > BigInt(latest.id)) latest = m
  }
  return latest
}

// "<@bot> 512 734" → { x: 512, y: 734 } (in-game coordinates), or null.
function parseCoords(content) {
  const text = (content ?? '').replace(/<[@#][!&]?\d+>/g, ' ')
  const match = text.match(/(\d{1,5})\D+(\d{1,5})/)
  return match ? { x: parseInt(match[1], 10), y: parseInt(match[2], 10) } : null
}

async function reply(env, message, content) {
  await fetch(`${DISCORD_API}/channels/${message.channel_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${env.ORE_FINDER_DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      message_reference: { message_id: message.id, fail_if_not_exists: false },
      allowed_mentions: { parse: [] },
    }),
  })
}

async function handleReport(env, channel, message) {
  if (!channel.map) {
    return reply(env, message, '⚠️ This channel has no report map yet - set one with `/orefinder-reportmap`.')
  }
  const coords = parseCoords(message.content)
  if (!coords) return handleZoneReport(env, channel, message)

  const map = await env.DB.prepare('SELECT width, height FROM maps WHERE name = ?').bind(channel.map).first()
  if (!map) return reply(env, message, `❌ Map **${mapLabel(channel.map)}** isn't on the Ore Finder map.`)
  if (coords.x > map.width || coords.y > map.height) {
    return reply(env, message, `❌ **${coords.x}, ${coords.y}** is outside ${mapLabel(channel.map)} (max ${map.width}, ${map.height}).`)
  }

  const now = new Date()
  const windowOpen = isOreAddWindowOpen(now)
  const existing = await env.DB.prepare('SELECT id FROM ore_finder_ores WHERE map = ? AND expires_at > ?')
    .bind(channel.map, now.toISOString()).first()

  if (env.ORE_FINDER_READER_DRY_RUN === '1') {
    const notes = [
      !windowOpen ? 'outside the report window (xx:58-xx:09 / xx:28-xx:39) - would be refused' : null,
      existing ? 'an ore is already marked on this map - would be refused' : null,
    ].filter(Boolean)
    return reply(env, message,
      `🧪 **Test mode** - nothing was added.\nRead: **${mapLabel(channel.map)}** - **${coords.x}, ${coords.y}**` +
      (notes.length ? `\n${notes.map(n => `• ${n}`).join('\n')}` : '\n✅ Would be added to the Ore Finder.'))
  }

  // Live reporting isn't switched on yet - kept as a dry run until tested.
  return reply(env, message, `Read: **${mapLabel(channel.map)}** - **${coords.x}, ${coords.y}** (live reporting isn't enabled yet).`)
}

// No coordinates in the message - look for one of the map's circles instead
// ("bio", "guard"...). The alert itself is sent from its own invocation.
async function handleZoneReport(env, channel, message) {
  const zones = (await env.DB.prepare('SELECT id, name FROM ore_finder_zones WHERE map = ?').bind(channel.map).all()).results
  const match = matchZone(zones, message.content)
  if (!match) {
    return reply(env, message,
      `❌ Couldn't read that. Write coordinates like \`@Ore Finder 512 734\`` +
      (zones.length ? ` or a place on **${mapLabel(channel.map)}**: ${zoneHelp(zones)}.` : ` (map: **${mapLabel(channel.map)}**).`))
  }
  if (match.ambiguous) {
    return reply(env, message, `❓ Which one did you mean: ${match.ambiguous.map(z => `**${z.name}**`).join(', ')}?`)
  }
  if (!env.ORE_FINDER_READER_TEST_CHANNEL_ID && !isOreAddWindowOpen(new Date())) return
  await env.SELF.fetch('https://internal/discord/zone-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': env.AUTH_SECRET },
    body: JSON.stringify({
      zoneId: match.zone.id,
      reportChannelId: message.channel_id,
      reportMessageId: message.id,
      dryRun: env.ORE_FINDER_READER_DRY_RUN === '1',
    }),
  })
}
