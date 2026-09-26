// Ore Finder reports made on Discord with exact coordinates ("@Ore Finder
// 512 734" in a /of-reportmap channel) - part of the channel reader
// feature. Adds the ore exactly like a report from the website would (same
// window, one ore per map per cycle, spawn history, report log, the regular
// Discord alert to every server). Runs in its own invocation (POST
// /discord/ore-report via the SELF binding) so the alert to every channel
// gets its own subrequest budget.

import { isOreAddWindowOpen, nextOreExpiryMark } from './db.js'
import { sendDiscordOreAlert } from './oreFinderDiscord.js'

const DISCORD_API = 'https://discord.com/api/v10'
const MAP_COLORS = { Yongan: 'red', Joan: 'yellow', Pyungmoo: 'blue' }
const mapLabel = name => `${name} (${MAP_COLORS[name] || name})`

async function reply(env, channelId, messageId, content) {
  await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${env.ORE_FINDER_DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      message_reference: { message_id: messageId, fail_if_not_exists: false },
      allowed_mentions: { parse: [] },
    }),
  })
}

// Stops reading the report channel until the next report window.
export async function pauseReportChannel(env, channelId, now) {
  await env.DB.prepare('UPDATE ore_finder_report_channels SET paused_until = ? WHERE channel_id = ?')
    .bind(nextOreExpiryMark(now).toISOString(), channelId).run()
}

// Internal endpoint (SELF binding only):
// { map, x, y (in-game coords), channelId, messageId, guildId, userId }.
export async function handleOreReport(request, env, headers) {
  const json = (data, status) => new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) })
  if (!env.AUTH_SECRET || request.headers.get('X-Internal-Key') !== env.AUTH_SECRET) return json({ error: 'forbidden' }, 403)

  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'bad request' }, 400)
  const say = content => reply(env, body.channelId, body.messageId, content)

  const map = await env.DB.prepare('SELECT width, height FROM maps WHERE name = ?').bind(body.map).first()
  if (!map) return json({ error: 'unknown map' }, 404)

  const now = new Date()
  if (!isOreAddWindowOpen(now)) {
    await say('⏰ Ores can only be reported xx:58-xx:09 and xx:28-xx:39.')
    return json({ ok: false, reason: 'window closed' }, 200)
  }

  const nowIso = now.toISOString()
  await env.DB.prepare('DELETE FROM ore_finder_ores WHERE map = ? AND expires_at <= ?').bind(body.map, nowIso).run()
  const existing = await env.DB.prepare('SELECT id FROM ore_finder_ores WHERE map = ?').bind(body.map).first()
  if (existing) {
    await say(`ℹ️ An ore is already marked on **${mapLabel(body.map)}** this cycle.`)
    return json({ ok: false, reason: 'already marked' }, 200)
  }

  const ore = {
    id: crypto.randomUUID(),
    map: body.map,
    x: (body.x / map.width) * 100,
    y: (body.y / map.height) * 100,
    comment: null,
    created_at: nowIso,
    expires_at: nextOreExpiryMark(now).toISOString(),
  }
  try {
    await env.DB.prepare('INSERT INTO ore_finder_ores (id, map, x, y, comment, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(ore.id, ore.map, ore.x, ore.y, ore.comment, ore.created_at, ore.expires_at).run()
  } catch {
    // Unique index on map - someone else (website or another server) was faster.
    await say(`ℹ️ An ore is already marked on **${mapLabel(body.map)}** this cycle.`)
    return json({ ok: false, reason: 'already marked' }, 200)
  }

  await env.DB.batch([
    env.DB.prepare('INSERT INTO ore_finder_spawn_history (id, map, x, y, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), ore.map, ore.x, ore.y, ore.created_at),
    // Admin report log: no IP on Discord - the reporter is identified by server/user instead.
    env.DB.prepare('INSERT INTO ore_finder_report_log (id, ip, map, x, y, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), `discord:${body.guildId || '?'}:${body.userId || '?'}`, ore.map, ore.x, ore.y, null, ore.created_at),
  ])
  await pauseReportChannel(env, body.channelId, now)
  await sendDiscordOreAlert(env, ore)
  await say(`✅ Added **${mapLabel(ore.map)}** - **${body.x}, ${body.y}** to the Ore Finder.`)
  return json({ ok: true }, 200)
}
