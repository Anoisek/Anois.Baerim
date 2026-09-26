// Ore Finder zone alerts - part of the channel reader feature (separate from
// the regular ore alerts in oreFinderDiscord.js, which are untouched).
//
// In a /orefinder-reportmap channel, "@Ore Finder bio" (a zone name instead of
// coordinates) is matched against the admin's circles for that map
// (ore_finder_zones) and a map image with that circle highlighted is sent to
// every alert channel listening to the map (same destinations as ore alerts).
// Runs as its own invocation (POST /discord/zone-alert via the SELF binding),
// so the posts to every channel get their own 50-subrequest budget.

import { PhotonImage } from '@cf-wasm/photon/workerd'
import { nextOreExpiryMark } from './db.js'
import { pauseReportChannel } from './oreFinderDiscordReport.js'

const DISCORD_API = 'https://discord.com/api/v10'
const MAP_COLORS = { Yongan: 'red', Joan: 'yellow', Pyungmoo: 'blue' }
const MAX_DESTINATIONS = 45 // leaves room for the reply within the 50-subrequest budget
const ZONE_FILL = [239, 68, 68] // red-500
const ZONE_FILL_ALPHA = 0.35
const ZONE_BORDER_ALPHA = 0.9
const ZONE_BORDER_WIDTH = 4

// Extra names people may type for a circle, keyed by the circle's name
// (lowercase). A circle's own name - and any 3+ letter start of it ("bio",
// "fish") - always works too, so new circles need no entry here.
const ZONE_ALIASES = {
  biologist: ['bio', 'biolog', 'biologista', 'biolożka', 'biologia'],
  center: ['centre', 'centrum', 'mid', 'middle', 'guardian', 'guard', 'guardians', 'srodek', 'środek'],
  fisherman: ['fish', 'fisher', 'fishman', 'fishing', 'rybak', 'ryba'],
  forest: ['las', 'woods', 'wood', 'trees', 'tree', 'lasek'],
  soon: ['soon'],
  wonda: ['wonda'],
  camp: ['camping', 'oboz', 'obóz', 'obozowisko', 'tents', 'tent'],
  'stable boy': ['stable', 'stableboy', 'stable-boy', 'stabel', 'horse', 'horses', 'stajnia', 'stajenny', 'kon', 'koń'],
}

const mapLabel = name => `${name} (${MAP_COLORS[name] || name})`

function normalize(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
}

function namesOf(zone) {
  const own = normalize(zone.name)
  return [own, own.replace(/\s+/g, ''), ...(ZONE_ALIASES[normalize(zone.name)] ?? []).map(normalize)]
}

// Picks the circle a message refers to. Whole-word name/alias hits win; a word
// of 3+ letters that starts a circle's name ("bio", "stab") is the fallback.
// Returns { zone } | { ambiguous: [zones] } | null.
export function matchZone(zones, content) {
  const text = ' ' + normalize(content).replace(/<[@#][!&]?\d+>/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ') + ' '
  const words = text.trim().split(' ').filter(w => w.length >= 3)

  const exact = zones.filter(z => namesOf(z).some(n => n && text.includes(` ${n} `)))
  if (exact.length === 1) return { zone: exact[0] }
  if (exact.length > 1) return { ambiguous: exact }

  const prefix = zones.filter(z => words.some(w => namesOf(z).some(n => n.startsWith(w))))
  if (prefix.length === 1) return { zone: prefix[0] }
  if (prefix.length > 1) return { ambiguous: prefix }
  return null
}

export function zoneHelp(zones) {
  return zones.map(z => {
    const aliases = (ZONE_ALIASES[normalize(z.name)] ?? []).filter(a => a !== normalize(z.name)).slice(0, 3)
    return aliases.length ? `**${z.name}** (${aliases.join(', ')})` : `**${z.name}**`
  }).join(', ')
}

// Map from R2 with the circle painted as a translucent red disc + border.
async function buildZoneMapImage(env, map, zone) {
  const prefix = env.PUBLIC_R2_URL + '/'
  if (!map.image_url.startsWith(prefix)) throw new Error('map image_url is not from this worker\'s R2 bucket')
  const object = await env.IMAGES_BUCKET.get(map.image_url.slice(prefix.length))
  if (!object) throw new Error('map image not found in R2')

  const image = PhotonImage.new_from_byteslice(new Uint8Array(await object.arrayBuffer()))
  const width = image.get_width()
  const height = image.get_height()
  const pixels = image.get_raw_pixels()

  const cx = (zone.x / 100) * width
  const cy = (zone.y / 100) * height
  const radius = (zone.r / 100) * width
  const inner = Math.max(0, radius - ZONE_BORDER_WIDTH)
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(width - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(height - 1, Math.ceil(cy + radius))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.hypot(x - cx + 0.5, y - cy + 0.5)
      if (d > radius) continue
      const a = d > inner ? ZONE_BORDER_ALPHA : ZONE_FILL_ALPHA
      const idx = (y * width + x) * 4
      for (let c = 0; c < 3; c++) pixels[idx + c] = Math.round(pixels[idx + c] * (1 - a) + ZONE_FILL[c] * a)
    }
  }

  const marked = new PhotonImage(pixels, width, height)
  const png = marked.get_bytes()
  image.free()
  marked.free()
  return png
}

// Same destinations as the regular ore alerts: legacy channel + every server
// that set up /orefinder-here and didn't opt out of this map.
async function alertDestinations(env, mapName) {
  const destinations = []
  if (env.ORE_FINDER_DISCORD_CHANNEL_ID) {
    destinations.push({ channelId: env.ORE_FINDER_DISCORD_CHANNEL_ID, roleId: env.ORE_FINDER_DISCORD_ROLE_ID })
  }
  const configured = await env.DB.prepare('SELECT channel_id, role_id, excluded_maps FROM ore_finder_discord_configs').all()
  for (const row of configured.results) {
    let excluded = []
    try { excluded = row.excluded_maps ? JSON.parse(row.excluded_maps) : [] } catch { excluded = [] }
    if (!excluded.includes(mapName)) destinations.push({ channelId: row.channel_id, roleId: row.role_id })
  }
  return destinations
}

async function postMessage(env, channelId, payload, png) {
  const form = new FormData()
  form.append('payload_json', JSON.stringify(payload))
  if (png) form.append('files[0]', new Blob([png], { type: 'image/png' }), 'ore-zone.png')
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${env.ORE_FINDER_DISCORD_BOT_TOKEN}` },
    body: form,
  })
  if (!res.ok) console.log('ore zone alert send failed', channelId, res.status, await res.text().catch(() => ''))
  return res.ok
}

function zoneEmbed(mapName, zone) {
  return {
    title: '🪨 Legendary ore reported!',
    description: `🗺️ Map: **${mapLabel(mapName)}**\n⭕ Somewhere around: **${zone.name}**`,
    color: 15680580, // red-500-ish
    image: { url: 'attachment://ore-zone.png' },
    timestamp: new Date().toISOString(),
  }
}

// Internal endpoint (SELF binding only): { zoneId, reportChannelId, reportMessageId, dryRun }.
export async function handleZoneAlert(request, env, headers) {
  const json = (data, status) => new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) })
  if (!env.AUTH_SECRET || request.headers.get('X-Internal-Key') !== env.AUTH_SECRET) return json({ error: 'forbidden' }, 403)

  const body = await request.json().catch(() => null)
  const zone = body?.zoneId ? await env.DB.prepare('SELECT * FROM ore_finder_zones WHERE id = ?').bind(body.zoneId).first() : null
  if (!zone) return json({ error: 'unknown zone' }, 404)
  const map = await env.DB.prepare('SELECT image_url, width, height FROM maps WHERE name = ?').bind(zone.map).first()
  if (!map) return json({ error: 'unknown map' }, 404)

  const reply = content => postMessage(env, body.reportChannelId, {
    content,
    message_reference: { message_id: body.reportMessageId, fail_if_not_exists: false },
    allowed_mentions: { parse: [] },
  })

  const destinations = await alertDestinations(env, zone.map)
  const png = await buildZoneMapImage(env, map, zone)

  if (body.dryRun) {
    await postMessage(env, body.reportChannelId, {
      content: `🧪 **Test mode** - this alert would be sent to **${destinations.length}** channel(s) listening to ${mapLabel(zone.map)}. Nothing was sent.`,
      embeds: [zoneEmbed(zone.map, zone)],
      message_reference: { message_id: body.reportMessageId, fail_if_not_exists: false },
      allowed_mentions: { parse: [] },
    }, png)
    return json({ ok: true, dryRun: true, destinations: destinations.length }, 200)
  }

  // One zone alert per map per ore cycle - a second report of the same map is
  // refused, and so is one for a map that already has an exact ore marked.
  const now = new Date()
  const nowIso = now.toISOString()
  const marked = await env.DB.prepare('SELECT id FROM ore_finder_ores WHERE map = ? AND expires_at > ?').bind(zone.map, nowIso).first()
  if (marked) {
    await reply(`ℹ️ An ore is already marked on **${mapLabel(zone.map)}** this cycle.`)
    return json({ ok: false, reason: 'already marked' }, 200)
  }
  const existing = await env.DB.prepare('SELECT zone_name FROM ore_finder_zone_alerts WHERE map = ? AND expires_at > ?').bind(zone.map, nowIso).first()
  if (existing) {
    await reply(`ℹ️ ${mapLabel(zone.map)} was already reported this cycle (around **${existing.zone_name}**).`)
    return json({ ok: false, reason: 'already reported' }, 200)
  }
  await env.DB.prepare(
    'INSERT INTO ore_finder_zone_alerts (map, zone_name, expires_at, created_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(map) DO UPDATE SET zone_name = excluded.zone_name, expires_at = excluded.expires_at, created_at = excluded.created_at'
  ).bind(zone.map, zone.name, nextOreExpiryMark(now).toISOString(), nowIso).run()

  const targets = destinations.slice(0, MAX_DESTINATIONS)
  if (destinations.length > targets.length) console.log('ore zone alert: too many destinations, some skipped', destinations.length)
  const results = await Promise.all(targets.map(d => postMessage(env, d.channelId, {
    content: d.roleId ? `<@&${d.roleId}>` : undefined,
    embeds: [zoneEmbed(zone.map, zone)],
  }, png)))
  const sent = results.filter(Boolean).length
  await pauseReportChannel(env, body.reportChannelId, now)
  await reply(`✅ Sent to ${sent} channel(s): **${mapLabel(zone.map)}** - around **${zone.name}**.`)
  return json({ ok: true, sent }, 200)
}
