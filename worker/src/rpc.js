// POST /rpc/:name — Worker-side equivalents of the Supabase Postgres RPC functions.
// Phase 2.2 implements submit_material_price only; the map-system RPCs
// (map_marker_counts, map_pending_reveal, toggle_note_like) are Phase 2.3 scope.

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  })
}

function median(numbers) {
  const sorted = numbers.slice().sort(function (a, b) { return a - b })
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Mirrors the Postgres function submit_material_price(p_material_id, p_price):
// validates the submission isn't too far off the current global price, records it,
// then recomputes global_prices as the median of the last 20 accepted submissions.
async function submitMaterialPrice(env, params, headers) {
  const materialId = params?.p_material_id
  const price = Number(params?.p_price)

  if (typeof materialId !== 'string' || !materialId || !(price > 0)) {
    return json({ data: false, error: null }, 200, headers)
  }

  const material = await env.DB.prepare('SELECT no_price FROM materials WHERE id = ?').bind(materialId).first()
  if (material?.no_price) {
    return json({ data: false, error: null }, 200, headers)
  }

  const current = await env.DB.prepare('SELECT price FROM global_prices WHERE material_id = ?').bind(materialId).first()

  if (current) {
    const relativeCap = current.price * 1.0
    const absoluteCap = 500000000
    const floorAbs = 1000
    const allowed = Math.max(Math.min(relativeCap, absoluteCap), floorAbs)
    if (Math.abs(price - current.price) > allowed) {
      return json({ data: false, error: null }, 200, headers)
    }
  }

  const nowIso = new Date().toISOString()
  await env.DB.prepare('INSERT INTO global_price_submissions (id, material_id, price, created_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), materialId, price, nowIso)
    .run()

  const recent = await env.DB.prepare(
    'SELECT price FROM global_price_submissions WHERE material_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(materialId).all()
  const prices = recent.results.map(function (r) { return r.price })
  const medianPrice = median(prices)

  await env.DB.prepare(
    'INSERT INTO global_prices (material_id, price, submission_count, updated_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(material_id) DO UPDATE SET price = excluded.price, submission_count = excluded.submission_count, updated_at = excluded.updated_at'
  ).bind(materialId, medianPrice, prices.length, nowIso).run()

  return json({ data: true, error: null }, 200, headers)
}

// Deliberately does NOT filter by visible_at — mirrors the Postgres function exactly.
// Maps.jsx shows the total marker count per map including not-yet-revealed ones (⏳).
async function mapMarkerCounts(env, headers) {
  const res = await env.DB.prepare('SELECT map_id, COUNT(*) as total FROM map_markers GROUP BY map_id').all()
  return json({ data: res.results, error: null }, 200, headers)
}

// Deliberately does NOT filter by visible_at either (same bypass as above) — only ever
// exposes map_id + the reveal timestamp, never marker content. Mirrors Postgres's
// `distinct on (map_id) ... order by map_id, created_at desc`.
async function mapPendingReveal(env, headers) {
  const nowIso = new Date().toISOString()
  const res = await env.DB.prepare(
    'SELECT map_id, visible_at, created_at FROM map_markers WHERE visible_at IS NOT NULL AND visible_at > ? ORDER BY map_id, created_at DESC'
  ).bind(nowIso).all()

  const seen = new Set()
  const out = []
  for (const row of res.results) {
    if (seen.has(row.map_id)) continue
    seen.add(row.map_id)
    out.push({ map_id: row.map_id, reveal_at: row.visible_at })
  }
  return json({ data: out, error: null }, 200, headers)
}

// delta is clamped to {-1, +1} — the frontend only ever sends one or the other (like/unlike),
// and without RLS as a backstop this closes off an anonymous like-count-inflation vector
// that existed in the original Postgres RPC (it accepted any integer from anon).
async function toggleNoteLike(env, params, headers) {
  const noteId = params && params.note_id
  const delta = params && params.delta
  if (typeof noteId !== 'string' || !noteId || (delta !== 1 && delta !== -1)) {
    return json({ data: null, error: { message: 'invalid params' } }, 400, headers)
  }
  const res = await env.DB.prepare(
    'UPDATE map_marker_notes SET likes = MAX(0, likes + ?) WHERE id = ? RETURNING likes'
  ).bind(delta, noteId).first()
  if (!res) return json({ data: null, error: { message: 'note not found' } }, 404, headers)
  return json({ data: res.likes, error: null }, 200, headers)
}

// Adds one user's session (kills + looted quantity per material) to the running
// total for each material, so metin_drop_stats.total_quantity / total_kills is a
// kills-weighted average probability across every submission ever made. Open to
// any caller (no auth) — mirrors submit_material_price, which is public too.
// p_vote_buff/p_casual_buff/p_glove_buff/p_guild_buff (from MetinBuffModal,
// asked on every metin page visit) route the submission into its own running
// total so differently-buffed sessions never blend into one misleading average.
async function submitMetinDropStats(env, params, headers) {
  const metinId = params && params.p_metin_id
  const kills = Number(params && params.p_kills)
  const quantities = params && params.p_quantities
  const voteBuff = params && params.p_vote_buff ? 1 : 0
  const casualBuff = params && params.p_casual_buff ? 1 : 0
  const gloveBuff = params && params.p_glove_buff ? 1 : 0
  const guildBuff = params && params.p_guild_buff ? 1 : 0

  if (typeof metinId !== 'string' || !metinId || !(kills > 0) || !(kills < 100000) ||
      typeof quantities !== 'object' || quantities === null) {
    return json({ data: false, error: null }, 200, headers)
  }

  const entries = Object.entries(quantities).filter(function (entry) {
    const qty = Number(entry[1])
    return typeof entry[0] === 'string' && entry[0] && Number.isFinite(qty) && qty >= 0
  })
  if (entries.length === 0) return json({ data: false, error: null }, 200, headers)

  for (const [materialId, qty] of entries) {
    await env.DB.prepare(
      'INSERT INTO metin_drop_stats (metin_id, material_id, vote_buff, casual_buff, glove_buff, guild_buff, total_quantity, total_kills) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(metin_id, material_id, vote_buff, casual_buff, glove_buff, guild_buff) DO UPDATE SET total_quantity = total_quantity + excluded.total_quantity, total_kills = total_kills + excluded.total_kills'
    ).bind(metinId, materialId, voteBuff, casualBuff, gloveBuff, guildBuff, Number(qty), kills).run()
  }

  return json({ data: true, error: null }, 200, headers)
}

// A ping's open_until claim outlives the client's heartbeat interval (20s, see
// VisitorPing.jsx) by this much slack, so one missed/delayed ping doesn't flicker
// someone offline. A "leaving" ping (sendBeacon on tab hide/close) collapses
// open_until to right now instead, which is what makes closing a tab drop out of
// the online count almost immediately rather than waiting out this whole window.
const OPEN_WINDOW_MS = 45 * 1000

// Anonymous, client-generated visitor_id (see src/utils/visitorId.js) — no IP, no
// account, no personal data, just an opaque id in the caller's own localStorage.
async function pingVisitor(env, params, headers) {
  const visitorId = params && params.visitor_id
  if (typeof visitorId !== 'string' || !visitorId || visitorId.length > 100) {
    return json({ data: false, error: null }, 200, headers)
  }
  const leaving = !!(params && params.leaving)
  const nowIso = new Date().toISOString()
  const openUntilIso = leaving ? nowIso : new Date(Date.now() + OPEN_WINDOW_MS).toISOString()
  await env.DB.prepare(
    'INSERT INTO visitors (visitor_id, first_seen, last_seen, open_until) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(visitor_id) DO UPDATE SET last_seen = excluded.last_seen, open_until = excluded.open_until'
  ).bind(visitorId, nowIso, nowIso, openUntilIso).run()
  return json({ data: true, error: null }, 200, headers)
}

// Admin-only. "Online now" checks the short-lived open_until claim (see above).
// day/week/month count NEW browsers (first_seen in that window) — a returning
// visitor who first showed up last month doesn't inflate "today"'s count just
// because they're still around; "overall" is every browser ever, unfiltered.
async function visitorStats(env, headers, isAdmin, request) {
  if (!(await isAdmin(request, env))) return json({ data: null, error: { message: 'forbidden' } }, 403, headers)

  const now = Date.now()
  const since = function (ms) { return new Date(now - ms).toISOString() }
  const countSince = async function (iso) {
    const res = await env.DB.prepare('SELECT COUNT(*) as c FROM visitors WHERE first_seen >= ?').bind(iso).first()
    return res ? res.c : 0
  }
  const onlineRes = await env.DB.prepare('SELECT COUNT(*) as c FROM visitors WHERE open_until >= ?').bind(new Date(now).toISOString()).first()
  const totalRes = await env.DB.prepare('SELECT COUNT(*) as c FROM visitors').first()

  const [day, week, month] = await Promise.all([
    countSince(since(24 * 3600 * 1000)),
    countSince(since(7 * 24 * 3600 * 1000)),
    countSince(since(30 * 24 * 3600 * 1000)),
  ])

  return json({ data: { online: onlineRes ? onlineRes.c : 0, day: day, week: week, month: month, overall: totalRes ? totalRes.c : 0 }, error: null }, 200, headers)
}

async function handleRpcRequest(request, env, url, headers, isAdmin) {
  const parts = url.pathname.split('/').filter(Boolean) // ['rpc', ':name']
  const name = parts[1]
  const params = await request.json().catch(function () { return {} })

  if (name === 'submit_material_price') return submitMaterialPrice(env, params, headers)
  if (name === 'submit_metin_drop_stats') return submitMetinDropStats(env, params, headers)
  if (name === 'map_marker_counts') return mapMarkerCounts(env, headers)
  if (name === 'map_pending_reveal') return mapPendingReveal(env, headers)
  if (name === 'toggle_note_like') return toggleNoteLike(env, params, headers)
  if (name === 'ping_visitor') return pingVisitor(env, params, headers)
  if (name === 'visitor_stats') return visitorStats(env, headers, isAdmin, request)

  return json({ data: null, error: { message: 'unknown rpc: ' + name } }, 404, headers)
}

export { handleRpcRequest }
