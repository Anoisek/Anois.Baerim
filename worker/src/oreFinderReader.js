// Ore Finder channel reader - an extra, independent feature on top of the
// existing Ore Finder bot (alerts and slash commands are untouched).
//
// A Cron Trigger fires every minute inside the windows xx:58-xx:10 and
// xx:29-xx:40 and reads new messages from every channel the bot posts ore
// alerts to (the legacy channel + each server's /orefinder-here channel),
// twice per minute (at :00 and ~:30). No Gateway connection is needed - it
// polls Discord's REST API.
//
// Batching: a Workers Free invocation may make only 50 external subrequests,
// so channels are split into batches of BATCH_SIZE and each batch is handled
// in its own invocation of this same Worker (via the SELF service binding),
// each with its own 50-subrequest budget. One request can fan out to at most
// 32 invocations, and there are two rounds per minute, so up to 16 batches
// (~400 channels) fit before this needs to change.
//
// Turned on/off with ORE_FINDER_READER_ENABLED ("1" = on) in wrangler.toml.

const BATCH_SIZE = 25 // leaves ~half the 50-subrequest budget for acting on what was read
const MAX_BATCHES_PER_ROUND = 16
const SECOND_ROUND_DELAY_MS = 30_000
const CONCURRENCY = 5 // Workers allow 6 simultaneous outgoing connections
const DISCORD_API = 'https://discord.com/api/v10'

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

export function inReadWindow(date) {
  const m = date.getUTCMinutes()
  return m >= 58 || m <= 10 || (m >= 29 && m <= 40)
}

// Same destinations as the ore alerts: legacy channel + every configured server.
async function readerChannels(env) {
  const channels = []
  if (env.ORE_FINDER_DISCORD_CHANNEL_ID) channels.push({ channelId: env.ORE_FINDER_DISCORD_CHANNEL_ID, guildId: null })
  const configured = await env.DB.prepare('SELECT guild_id, channel_id FROM ore_finder_discord_configs').all()
  for (const row of configured.results) channels.push({ channelId: row.channel_id, guildId: row.guild_id })
  const seen = new Set()
  return channels.filter(c => c.channelId && !seen.has(c.channelId) && seen.add(c.channelId))
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
  if (!inReadWindow(new Date())) return
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

    const messages = (await res.json()).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    if (messages.length === 0) return { channelId: channel.channelId, read: 0 }

    const newest = messages.reduce((id, m) => newerId(id, m.id), messages[0].id)
    if (lastId) await processChannelMessages(env, channel, messages)
    await env.DB.prepare(
      'INSERT INTO ore_finder_read_cursors (channel_id, last_message_id, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(channel_id) DO UPDATE SET last_message_id = excluded.last_message_id, updated_at = excluded.updated_at'
    ).bind(channel.channelId, newest, new Date().toISOString()).run()
    return { channelId: channel.channelId, read: lastId ? messages.length : 0 }
  } catch (err) {
    return { channelId: channel.channelId, error: (err && err.message) || 'failed' }
  }
}

// What to do with newly read messages (oldest first). Placeholder until the
// feature is defined - for now reading only advances each channel's cursor.
// Message text needs the "Message Content Intent" enabled in the Discord
// Developer Portal; without it `content` comes back empty.
async function processChannelMessages(env, channel, messages) { // eslint-disable-line no-unused-vars
}
