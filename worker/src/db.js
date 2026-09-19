// Generic /db/:table CRUD layer over D1, scoped to Phase 2.1 (catalog tables), 2.2
// (community pricing) and 2.3 (interactive map). D1 has no RLS, so this file is the
// entire authorization boundary: only tables and columns listed in TABLES are reachable,
// and only through the operations enabled below.
//
// Per-table config:
//   publicRead: false        -> GET also requires admin (default true = public GET)
//   insertAuth: 'editor'     -> POST allowed for admin OR map editor (default 'admin' = admin only)
//   insertAuth: 'public'     -> POST allowed with no auth at all
//   visibilityFilter: true   -> GET hides rows with a future visible_at unless caller is admin
//   beforeInsert: fn(row)    -> return { row } (possibly transformed) or { error } to reject
//   deleteAuth: 'public'     -> DELETE allowed with no auth at all (default 'admin' = admin only)
//
// PATCH is always admin-only regardless of insertAuth (mirrors the Postgres RLS,
// where map editors could only INSERT, never UPDATE/DELETE). DELETE follows deleteAuth.

import { censorComment } from './profanity.js'
import { hasDisallowedLink, LINKS_NOT_ALLOWED } from './links.js'
import { broadcastToAll } from './webpush.js'
import { sendDiscordDogAlert } from './discord.js'
import { sendDiscordOreAlert } from './oreFinderDiscord.js'

const TABLES = {
  categories: {
    columns: ['id', 'name', 'image_url', 'created_at', 'sort_order', 'maintenance'],
    booleans: ['maintenance'],
    pk: ['id'],
  },
  subcategories: {
    columns: ['id', 'category_id', 'name', 'image_url', 'created_at', 'sort_order', 'maintenance'],
    booleans: ['maintenance'],
    pk: ['id'],
  },
  items: {
    columns: ['id', 'category_id', 'name', 'image_url', 'created_at', 'subcategory_id', 'image_urls', 'sort_order', 'maintenance'],
    booleans: ['maintenance'],
    jsonArrays: ['image_urls'],
    pk: ['id'],
  },
  materials: {
    columns: ['id', 'name', 'image_url', 'created_at', 'is_upgrade_scroll', 'is_seal', 'is_item', 'is_craftable', 'craft_yang_cost', 'is_pvp', 'is_pvp_only', 'category_tag', 'image_urls', 'no_price'],
    booleans: ['is_upgrade_scroll', 'is_seal', 'is_item', 'is_craftable', 'is_pvp', 'is_pvp_only', 'no_price'],
    jsonArrays: ['image_urls'],
    pk: ['id'],
  },
  // Chapter tabs on /materials. Public read (the client filters hidden chapters
  // out for non-admins), admin-only writes.
  material_chapters: {
    columns: ['id', 'name', 'visible', 'sort_order'],
    booleans: ['visible'],
    pk: ['id'],
  },
  material_chapter_members: { columns: ['chapter_id', 'material_id'], pk: ['chapter_id', 'material_id'] },
  item_materials: { columns: ['item_id', 'material_id', 'quantity', 'step', 'variant'], pk: ['item_id', 'material_id', 'step', 'variant'] },
  item_items: { columns: ['item_id', 'component_item_id', 'quantity', 'step', 'variant'], pk: ['item_id', 'component_item_id', 'step', 'variant'] },
  item_step_yang: { columns: ['item_id', 'step', 'yang_cost', 'max_pity', 'variant'], pk: ['item_id', 'step', 'variant'] },
  material_materials: { columns: ['material_id', 'component_id', 'quantity', 'variant'], pk: ['material_id', 'component_id', 'variant'] },
  material_craft_variant_yield: { columns: ['material_id', 'variant', 'yield'], pk: ['material_id', 'variant'] },
  exploration_levels: {
    columns: ['level', 'title', 'description', 'x_percent', 'y_percent', 'image_urls'],
    jsonArrays: ['image_urls'],
    pk: ['level'],
  },
  settings: { columns: ['key', 'value'], pk: ['key'] },
  global_prices: {
    columns: ['material_id', 'price', 'submission_count', 'updated_at'],
    pk: ['material_id'],
  },
  global_price_submissions: {
    columns: ['id', 'material_id', 'price', 'created_at'],
    pk: ['id'],
    publicRead: false,
  },
  maps: {
    columns: ['id', 'name', 'region', 'mark', 'image_url', 'width', 'height', 'sort_order', 'created_at', 'max_mokoko', 'admin_only'],
    booleans: ['admin_only'],
    pk: ['id'],
  },
  map_markers: {
    columns: ['id', 'map_id', 'x', 'y', 'icon', 'title', 'created_at', 'copied_from', 'visible_at'],
    pk: ['id'],
    insertAuth: 'editor',
    visibilityFilter: true,
  },
  map_marker_notes: {
    columns: ['id', 'marker_id', 'comment', 'image_url', 'created_at', 'likes'],
    pk: ['id'],
    insertAuth: 'public',
    beforeInsert: function (row) {
      const comment = typeof row.comment === 'string' ? row.comment.trim() : null
      const hasComment = !!comment && comment.length >= 1 && comment.length <= 1000
      const hasImage = !!row.image_url
      if (!hasComment && !hasImage) {
        return { error: 'comment must be 1-1000 characters, or image_url must be provided' }
      }
      if (comment && hasDisallowedLink(comment)) return { error: LINKS_NOT_ALLOWED }
      const clean = Object.assign({}, row)
      clean.comment = comment ? censorComment(comment) : null
      return { row: clean }
    },
  },
  map_helpers: {
    columns: ['id', 'name', 'sort_order', 'created_at'],
    pk: ['id'],
    insertAuth: 'editor',
  },
  metins: {
    columns: ['id', 'name', 'image_url', 'created_at', 'image_urls', 'sort_order'],
    jsonArrays: ['image_urls'],
    pk: ['id'],
  },
  metin_drops: {
    columns: ['metin_id', 'material_id', 'quantity', 'alt_group', 'sort_order', 'is_guaranteed'],
    booleans: ['is_guaranteed'],
    pk: ['metin_id', 'material_id'],
  },
  // Aggregated across every submit_metin_drop_stats RPC call (see rpc.js) — kept
  // admin-only for now since the drop-probability feature isn't public yet.
  // vote_buff/casual_buff/glove_buff/guild_buff split the running totals into
  // separate scenarios (see MetinBuffModal) so global % can be reported per
  // scenario instead of blending differently-buffed sessions into one
  // misleading average.
  metin_drop_stats: {
    columns: ['metin_id', 'material_id', 'vote_buff', 'casual_buff', 'glove_buff', 'guild_buff', 'total_quantity', 'total_kills'],
    booleans: ['vote_buff', 'casual_buff', 'glove_buff', 'guild_buff'],
    pk: ['metin_id', 'material_id', 'vote_buff', 'casual_buff', 'glove_buff', 'guild_buff'],
    publicRead: false,
  },
  bonuses: {
    columns: ['id', 'name', 'created_at', 'sort_order'],
    pk: ['id'],
  },
  bonus_items: {
    columns: ['id', 'bonus_id', 'name', 'image_url', 'value', 'created_at', 'sort_order'],
    pk: ['id'],
  },
  alchemy_stones: {
    columns: ['id', 'name', 'image_url', 'sort_order'],
    pk: ['id'],
  },
  alchemy_prices: {
    columns: ['key', 'price', 'submission_count', 'updated_at'],
    pk: ['key'],
  },
  alchemy_price_submissions: {
    columns: ['id', 'key', 'price', 'created_at'],
    pk: ['id'],
    publicRead: false,
  },
  // Live per-language overrides for the /kompendium community guide — see
  // schema.sql for the fallback-to-static-translation model. Admin-only
  // writes (default insertAuth), upserted by (category_id, item_index, lang).
  guide_items: {
    columns: ['category_id', 'item_index', 'lang', 'question', 'answer', 'updated_at'],
    pk: ['category_id', 'item_index', 'lang'],
  },
  guide_suggestions: {
    columns: ['id', 'category_id', 'item_index', 'lang', 'question', 'answer', 'created_at'],
    pk: ['id'],
    insertAuth: 'public',
    publicRead: false,
    beforeInsert: function (row) {
      const categoryId = typeof row.category_id === 'string' ? row.category_id : ''
      const itemIndex = Number(row.item_index)
      const lang = typeof row.lang === 'string' ? row.lang : ''
      const question = typeof row.question === 'string' ? row.question.trim() : ''
      const answer = typeof row.answer === 'string' ? row.answer.trim() : ''
      if (!GUIDE_CATEGORIES.has(categoryId)) return { error: 'unknown category_id' }
      if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex > 50) return { error: 'invalid item_index' }
      if (!GUIDE_LANGS.has(lang)) return { error: 'unknown lang' }
      if (!question || question.length > 500) return { error: 'question must be 1-500 characters' }
      if (!answer || answer.length > 2000) return { error: 'answer must be 1-2000 characters' }
      if (hasDisallowedLink(question) || hasDisallowedLink(answer)) return { error: LINKS_NOT_ALLOWED }
      return {
        row: {
          category_id: categoryId,
          item_index: itemIndex,
          lang: lang,
          question: censorComment(question),
          answer: censorComment(answer),
        },
      }
    },
  },
  // /dogtracker (beta): public live sightings, anyone can report, read, or
  // clear one (confirming "no longer there") — no accounts involved, so
  // both insert and delete are wide open by design.
  dogtracker_dogs: {
    columns: ['id', 'metin', 'tier', 'x', 'y', 'channel', 'created_at', 'discord_message_id'],
    pk: ['id'],
    insertAuth: 'public',
    deleteAuth: 'public',
    beforeInsert: function (row) {
      const metin = typeof row.metin === 'string' ? row.metin : ''
      const tier = typeof row.tier === 'string' ? row.tier : ''
      const x = Number(row.x)
      const y = Number(row.y)
      const channel = Number(row.channel)
      if (!DOGTRACKER_METINS.has(metin)) return { error: 'unknown metin' }
      if (!DOGTRACKER_TIERS.has(tier)) return { error: 'unknown tier' }
      if (!Number.isFinite(x) || x < 0 || x > 100) return { error: 'invalid x' }
      if (!Number.isFinite(y) || y < 0 || y > 100) return { error: 'invalid y' }
      if (!Number.isInteger(channel) || channel < 1 || channel > 6) return { error: 'invalid channel' }
      return { row: { metin: metin, tier: tier, x: x, y: y, channel: channel } }
    },
  },
  // Web Push subscriptions backing dogtracker's "new dog" notification -
  // a browser subscribes/unsubscribes itself, no account involved.
  dogtracker_push_subscriptions: {
    columns: ['endpoint', 'p256dh', 'auth', 'created_at'],
    pk: ['endpoint'],
    insertAuth: 'public',
    deleteAuth: 'public',
    publicRead: false,
  },
  // /systems/ore-finder: public live legendary-ore reports, one per map
  // (Yongan, Joan, Pyungmoo - enforced by the DB's unique index on `map`).
  // Anyone can report one (insertAuth public), but only admin can clear one
  // early - regular expiry cleanup still happens server-side in beforeInsert
  // and doesn't go through this HTTP delete path at all.
  ore_finder_ores: {
    columns: ['id', 'map', 'x', 'y', 'comment', 'created_at', 'expires_at', 'discord_message_id'],
    pk: ['id'],
    insertAuth: 'public',
    beforeInsert: async function (row, env, request, isAdminCheck) {
      const map = typeof row.map === 'string' ? row.map : ''
      const x = Number(row.x)
      const y = Number(row.y)
      const rawComment = typeof row.comment === 'string' ? row.comment.trim().slice(0, 200) : ''
      if (hasDisallowedLink(rawComment)) return { error: LINKS_NOT_ALLOWED }
      if (!ORE_FINDER_MAPS.has(map)) return { error: 'unknown map' }
      if (!Number.isFinite(x) || x < 0 || x > 100) return { error: 'invalid x' }
      if (!Number.isFinite(y) || y < 0 || y > 100) return { error: 'invalid y' }

      // Shadowban, not a hard block: a blocked IP passes every check below and
      // gets back a normal-looking success (their own screen shows the marker,
      // same expiry, same rules) - but see the `fake` branch below, nothing is
      // actually written to ore_finder_ores/spawn_history and no Discord alert
      // fires. This way a deliberate troll has no obvious signal they were cut
      // off and no reason to switch IP or escalate.
      const ip = request && request.headers.get('CF-Connecting-IP')
      let shadowBlocked = false
      if (ip) {
        const blocked = await env.DB.prepare('SELECT ip FROM ore_finder_blocked_ips WHERE ip = ?').bind(ip).first()
        if (blocked) shadowBlocked = true
      }

      const turnstileOk = await verifyTurnstile(env, row.turnstileToken, request)
      if (!turnstileOk) return { error: 'turnstile verification failed' }

      const now = new Date()
      if (!isOreAddWindowOpen(now)) {
        const admin = isAdminCheck ? await isAdminCheck(request, env) : false
        if (!admin) return { error: 'ore can only be marked xx:58-xx:09 or xx:28-xx:39' }
      }
      const expiresAt = nextOreExpiryMark(now)

      // Clear this map's marker if it's already expired (nobody's polled it
      // away yet), then refuse a second active marker on the same map -
      // only one legendary ore spawns per map per cycle.
      const nowIso = now.toISOString()
      await env.DB.prepare('DELETE FROM ore_finder_ores WHERE map = ? AND expires_at <= ?').bind(map, nowIso).run()
      const existing = await env.DB.prepare('SELECT id FROM ore_finder_ores WHERE map = ?').bind(map).first()
      if (existing) return { error: 'ore already marked on this map' }

      const resultRow = {
        map: map,
        x: x,
        y: y,
        comment: rawComment ? censorComment(rawComment) : null,
        expires_at: expiresAt.toISOString(),
      }
      return shadowBlocked ? { row: resultRow, fake: true } : { row: resultRow }
    },
  },
  // Read-only from the client's perspective (public GET) - rows are only
  // ever written by the ore_finder_ores insert hook above, never via a
  // direct POST here (default insertAuth 'admin' blocks that path).
  ore_finder_spawn_history: {
    columns: ['id', 'map', 'x', 'y', 'created_at'],
    pk: ['id'],
  },
  // Admin-only moderation log (never public - has reporting IPs). Written
  // only by the ore_finder_ores insert hook, same as spawn_history.
  ore_finder_report_log: {
    columns: ['id', 'ip', 'map', 'x', 'y', 'comment', 'created_at'],
    pk: ['id'],
    publicRead: false,
  },
  // Admin-managed IP blocklist for Ore Finder reporting - checked in
  // ore_finder_ores' beforeInsert above.
  ore_finder_blocked_ips: {
    columns: ['ip', 'created_at', 'note'],
    pk: ['ip'],
    publicRead: false,
    beforeInsert: function (row) {
      const ip = typeof row.ip === 'string' ? row.ip.trim() : ''
      if (!ip) return { error: 'ip is required' }
      return { row: { ip: ip, note: typeof row.note === 'string' ? row.note.trim().slice(0, 200) : null } }
    },
  },
  // /mokoko-finder (admin-only while testing): a report waits here until an
  // admin approves it (copied into mokoko_finder_spots, see the page's
  // approve flow) or rejects it (deleted outright). Never public - only the
  // admin reviewing the queue needs to see pending screenshots/coordinates.
  mokoko_finder_reports: {
    columns: ['id', 'map', 'x', 'y', 'screenshot_url', 'created_at'],
    pk: ['id'],
    insertAuth: 'public',
    publicRead: false,
    beforeInsert: async function (row, env, request) {
      const map = typeof row.map === 'string' ? row.map : ''
      const x = Number(row.x)
      const y = Number(row.y)
      const screenshotUrl = typeof row.screenshot_url === 'string' ? row.screenshot_url.trim() : ''
      if (!MOKOKO_FINDER_MAPS.has(map)) return { error: 'unknown map' }
      if (!Number.isFinite(x) || x < 0 || x > 100) return { error: 'invalid x' }
      if (!Number.isFinite(y) || y < 0 || y > 100) return { error: 'invalid y' }
      if (!screenshotUrl) return { error: 'screenshot_url is required' }

      const turnstileOk = await verifyTurnstile(env, row.turnstileToken, request)
      if (!turnstileOk) return { error: 'turnstile verification failed' }

      return { row: { map: map, x: x, y: y, screenshot_url: screenshotUrl } }
    },
  },
  // Approved mokoko sightings - public read (shown on the map), but only ever
  // written by the admin's approve action in the page (default insertAuth
  // 'admin'), never directly from a report submission.
  mokoko_finder_spots: {
    columns: ['id', 'map', 'x', 'y', 'screenshot_url', 'created_at'],
    pk: ['id'],
  },
  // Extra photos on an approved spot from merging several reports of the same
  // sighting (see MokokoFinderReviewModal) - admin-only write, public read
  // (shown alongside the spot, same convention as map_marker_notes).
  mokoko_finder_spot_notes: {
    columns: ['id', 'spot_id', 'image_url', 'created_at'],
    pk: ['id'],
  },
}

const ORE_FINDER_MAPS = new Set(['Yongan', 'Joan', 'Pyungmoo'])
const MOKOKO_FINDER_MAPS = new Set(['Yongan'])

// Cloudflare Turnstile check on ore reports - keeps reporting open to anyone
// (no accounts) while blocking scripted/bot spam. Inert-safe by design: if
// the secret isn't configured yet, verification is skipped rather than
// locking everyone out.
async function verifyTurnstile(env, token, request) {
  if (!env.ORE_FINDER_TURNSTILE_SECRET_KEY) return true
  if (!token || typeof token !== 'string') return false
  try {
    const body = new FormData()
    body.append('secret', env.ORE_FINDER_TURNSTILE_SECRET_KEY)
    body.append('response', token)
    const ip = request && request.headers.get('CF-Connecting-IP')
    if (ip) body.append('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    const data = await res.json()
    return !!data.success
  } catch {
    return false
  }
}

// Legendary ore can normally only be marked in the 12-minute window before
// each disappearance mark (xx:58-xx:09 before xx:10, xx:28-xx:39 before
// xx:40) - admin bypasses this check (see beforeInsert below).
function isOreAddWindowOpen(now) {
  const minute = now.getUTCMinutes()
  return (minute >= 28 && minute <= 39) || minute >= 58 || minute <= 9
}

// Next upcoming xx:10/xx:40 disappearance mark from `now` - always returns a
// value (never null), used for both in-window reports and admin's
// out-of-window override.
function nextOreExpiryMark(now) {
  const minute = now.getUTCMinutes()
  const expiry = new Date(now)
  expiry.setUTCSeconds(0, 0)
  if (minute < 10) {
    expiry.setUTCMinutes(10)
    return expiry
  }
  if (minute < 40) {
    expiry.setUTCMinutes(40)
    return expiry
  }
  expiry.setUTCHours(expiry.getUTCHours() + 1)
  expiry.setUTCMinutes(10)
  return expiry
}

const GUIDE_CATEGORIES = new Set(['zwoje', 'eventy', 'poziomy', 'yang', 'ekwipunek', 'techniczne', 'platnosci', 'skille', 'gildia'])
const GUIDE_LANGS = new Set(['pl', 'en', 'de', 'es', 'pt', 'pt-BR', 'fr', 'it', 'el', 'cs', 'sk', 'ro', 'tr'])
const DOGTRACKER_METINS = new Set(['Metin of Gloom', 'Metin of Ember', 'Metin of Wrath', 'Metin of Calamity'])
const DOGTRACKER_TIERS = new Set(['I', 'II', 'III'])

const MODIFIER_KEYS = new Set(['select', 'order', 'limit', 'count', 'head'])

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  })
}

function errorResponse(message, status, headers) {
  return json({ data: null, error: { message: message } }, status, headers)
}

function rowToClient(cfg, row) {
  const out = Object.assign({}, row)
  for (const col of cfg.booleans || []) {
    if (col in out) out[col] = !!out[col]
  }
  for (const col of cfg.jsonArrays || []) {
    if (col in out && typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]) } catch (e) { out[col] = [] }
    }
  }
  return out
}

function rowToDb(cfg, row) {
  const out = {}
  for (const key of Object.keys(row)) {
    if (cfg.columns.indexOf(key) === -1) continue
    let value = row[key]
    if ((cfg.booleans || []).indexOf(key) !== -1) value = value ? 1 : 0
    if ((cfg.jsonArrays || []).indexOf(key) !== -1) value = JSON.stringify(value ?? [])
    out[key] = value === undefined ? null : value
  }
  return out
}

function parseFilters(searchParams, cfg) {
  const where = []
  const params = []
  for (const [key, rawValue] of searchParams.entries()) {
    if (MODIFIER_KEYS.has(key)) continue
    if (cfg.columns.indexOf(key) === -1) return { error: 'unknown filter column: ' + key }
    const dot = rawValue.indexOf('.')
    if (dot === -1) return { error: 'invalid filter value for ' + key }
    const op = rawValue.slice(0, dot)
    let val = rawValue.slice(dot + 1)
    if ((cfg.booleans || []).indexOf(key) !== -1) val = val === 'true' ? '1' : '0'

    if (op === 'eq') { where.push(key + ' = ?'); params.push(val) }
    else if (op === 'neq') { where.push(key + ' != ?'); params.push(val) }
    else if (op === 'is' && val === 'null') { where.push(key + ' IS NULL') }
    else if (op === 'ilike') { where.push(key + ' LIKE ? ESCAPE \'\\\''); params.push(val.replace(/\*/g, '%')) }
    else return { error: 'unsupported filter operator: ' + op }
  }
  return { where: where, params: params }
}

function parseOrder(searchParams, cfg) {
  const raw = searchParams.get('order')
  if (!raw) return { clause: '' }
  const dot = raw.indexOf('.')
  const col = dot === -1 ? raw : raw.slice(0, dot)
  const dir = dot === -1 ? 'asc' : raw.slice(dot + 1)
  if (cfg.columns.indexOf(col) === -1) return { error: 'unknown order column: ' + col }
  if (dir !== 'asc' && dir !== 'desc') return { error: 'invalid order direction' }
  return { clause: ' ORDER BY ' + col + ' ' + dir.toUpperCase() }
}

async function handleGet(env, table, cfg, searchParams, headers, callerIsAdmin) {
  const filters = parseFilters(searchParams, cfg)
  if (filters.error) return errorResponse(filters.error, 400, headers)

  const isCount = searchParams.get('count') === 'exact' && searchParams.get('head') === '1'
  const whereClause = filters.where.length > 0 ? ' WHERE ' + filters.where.join(' AND ') : ''

  if (isCount) {
    const sql = 'SELECT COUNT(*) as c FROM ' + table + whereClause
    const res = await env.DB.prepare(sql).bind(...filters.params).first()
    return json({ data: null, error: null, count: res ? res.c : 0 }, 200, headers)
  }

  const order = parseOrder(searchParams, cfg)
  if (order.error) return errorResponse(order.error, 400, headers)
  const limitParam = searchParams.get('limit')
  const limitClause = limitParam ? ' LIMIT ' + parseInt(limitParam, 10) : ''

  const sql = 'SELECT * FROM ' + table + whereClause + order.clause + limitClause
  const res = await env.DB.prepare(sql).bind(...filters.params).all()

  let rows = res.results.map(function (r) { return rowToClient(cfg, r) })

  if (cfg.visibilityFilter && !callerIsAdmin) {
    const nowIso = new Date().toISOString()
    rows = rows.filter(function (r) { return !r.visible_at || r.visible_at <= nowIso })
  }

  const selectParam = searchParams.get('select')
  if (selectParam && selectParam !== '*') {
    const cols = selectParam.split(',').map(function (s) { return s.trim() })
    rows = rows.map(function (r) {
      const picked = {}
      for (const c of cols) picked[c] = r[c]
      return picked
    })
  }

  return json({ data: rows, error: null }, 200, headers)
}

async function handlePost(env, table, cfg, request, searchParams, headers, ctx, isAdmin) {
  const body = await request.json().catch(function () { return null })
  if (body === null) return errorResponse('invalid JSON body', 400, headers)
  const rows = Array.isArray(body) ? body : [body]
  const nowIso = new Date().toISOString()
  const isUpsert = searchParams.get('upsert') === '1'

  const inserted = []
  let anyFake = false
  for (let row of rows) {
    let isFake = false
    if (cfg.beforeInsert) {
      const result = await cfg.beforeInsert(row, env, request, isAdmin)
      if (result.error) return errorResponse(result.error, 400, headers)
      row = result.row
      isFake = !!result.fake
    }
    const clean = rowToDb(cfg, row)
    if (cfg.columns.indexOf('id') !== -1 && !clean.id) clean.id = crypto.randomUUID()
    if (cfg.columns.indexOf('created_at') !== -1 && !clean.created_at) clean.created_at = nowIso

    // Shadowban path (see ore_finder_ores' beforeInsert): looks exactly like
    // a normal successful insert to the caller, but nothing is written.
    if (isFake) {
      inserted.push(rowToClient(cfg, clean))
      anyFake = true
      continue
    }

    const cols = Object.keys(clean)
    if (cols.length === 0) return errorResponse('empty row', 400, headers)
    const placeholders = cols.map(function () { return '?' }).join(', ')
    let sql = 'INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + placeholders + ')'

    if (isUpsert) {
      const updateCols = cols.filter(function (c) { return (cfg.pk || []).indexOf(c) === -1 })
      if (updateCols.length > 0) {
        sql += ' ON CONFLICT(' + (cfg.pk || []).join(', ') + ') DO UPDATE SET ' +
          updateCols.map(function (c) { return c + ' = excluded.' + c }).join(', ')
      } else {
        sql += ' ON CONFLICT(' + (cfg.pk || []).join(', ') + ') DO NOTHING'
      }
    }
    sql += ' RETURNING *'

    const values = cols.map(function (c) { return clean[c] })
    const res = await env.DB.prepare(sql).bind(...values).first()
    if (res) inserted.push(rowToClient(cfg, res))
  }

  // Notify anyone with dogtracker open, without making the reporter wait on
  // every push send - ctx.waitUntil lets this keep running after the
  // response is already back with them.
  if (table === 'dogtracker_dogs' && inserted.length > 0 && ctx) {
    ctx.waitUntil(broadcastToAll(env, { type: 'dogtracker-dog-added', dogId: inserted[0].id }))
    ctx.waitUntil(sendDiscordDogAlert(env, inserted[0]))
  }

  if (table === 'ore_finder_ores' && inserted.length > 0 && ctx) {
    const ore = inserted[0]
    // Shadowbanned reports (see beforeInsert) never alert or join the public
    // spawn history - only the admin-only log below sees them, so the troll
    // gets a normal-looking success with zero real-world effect.
    if (!anyFake) {
      ctx.waitUntil(sendDiscordOreAlert(env, ore))
      ctx.waitUntil(
        env.DB.prepare('INSERT INTO ore_finder_spawn_history (id, map, x, y, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), ore.map, ore.x, ore.y, ore.created_at)
          .run()
      )
    }
    // Admin-only moderation log (with reporting IP) - separate table so the
    // IP never surfaces through the public spawn_history read above. Logged
    // even for shadowbanned attempts, so the admin can see they kept trying.
    const reporterIp = request && request.headers.get('CF-Connecting-IP')
    ctx.waitUntil(
      env.DB.prepare('INSERT INTO ore_finder_report_log (id, ip, map, x, y, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), reporterIp || null, ore.map, ore.x, ore.y, ore.comment, ore.created_at)
        .run()
    )
  }

  return json({ data: inserted, error: null }, 200, headers)
}

async function handlePatch(env, table, cfg, request, searchParams, headers) {
  const filters = parseFilters(searchParams, cfg)
  if (filters.error) return errorResponse(filters.error, 400, headers)
  if (filters.where.length === 0) return errorResponse('update requires at least one filter', 400, headers)

  const body = await request.json().catch(function () { return null })
  if (body === null) return errorResponse('invalid JSON body', 400, headers)
  const clean = rowToDb(cfg, body)
  const cols = Object.keys(clean)
  if (cols.length === 0) return errorResponse('empty patch', 400, headers)

  const setClause = cols.map(function (c) { return c + ' = ?' }).join(', ')
  const sql = 'UPDATE ' + table + ' SET ' + setClause + ' WHERE ' + filters.where.join(' AND ') + ' RETURNING *'
  const params = cols.map(function (c) { return clean[c] }).concat(filters.params)
  const res = await env.DB.prepare(sql).bind(...params).all()

  return json({ data: res.results.map(function (r) { return rowToClient(cfg, r) }), error: null }, 200, headers)
}

async function handleDelete(env, table, cfg, searchParams, headers) {
  const filters = parseFilters(searchParams, cfg)
  if (filters.error) return errorResponse(filters.error, 400, headers)
  if (filters.where.length === 0) return errorResponse('delete requires at least one filter', 400, headers)

  const sql = 'DELETE FROM ' + table + ' WHERE ' + filters.where.join(' AND ') + ' RETURNING *'
  const res = await env.DB.prepare(sql).bind(...filters.params).all()

  return json({ data: res.results.map(function (r) { return rowToClient(cfg, r) }), error: null }, 200, headers)
}

// PATCH always requires admin. POST/DELETE authorization depends on cfg.insertAuth /
// cfg.deleteAuth: 'admin' (default) -> admin only, insertAuth also allows 'editor'
// (admin or map editor), and both allow 'public' -> no auth.
async function handleDbRequest(request, env, url, headers, isAdmin, isEditor, ctx) {
  const parts = url.pathname.split('/').filter(Boolean) // ['db', ':table']
  const table = parts[1]
  if (!table || !TABLES[table]) return errorResponse('unknown table', 404, headers)
  const cfg = TABLES[table]

  if (request.method === 'GET') {
    if (cfg.publicRead === false && !(await isAdmin(request, env))) return errorResponse('forbidden', 403, headers)
    const callerIsAdmin = cfg.visibilityFilter ? await isAdmin(request, env) : false
    return handleGet(env, table, cfg, url.searchParams, headers, callerIsAdmin)
  }

  if (request.method === 'POST') {
    const insertAuth = cfg.insertAuth || 'admin'
    if (insertAuth === 'editor') {
      if (!(await isAdmin(request, env)) && !(await isEditor(request, env))) return errorResponse('forbidden', 403, headers)
    } else if (insertAuth === 'admin') {
      if (!(await isAdmin(request, env))) return errorResponse('forbidden', 403, headers)
    }
    // insertAuth === 'public' -> no check
    return handlePost(env, table, cfg, request, url.searchParams, headers, ctx, isAdmin)
  }

  if (request.method === 'PATCH') {
    if (!(await isAdmin(request, env))) return errorResponse('forbidden', 403, headers)
    return handlePatch(env, table, cfg, request, url.searchParams, headers)
  }

  if (request.method === 'DELETE') {
    const deleteAuth = cfg.deleteAuth || 'admin'
    if (deleteAuth !== 'public' && !(await isAdmin(request, env))) return errorResponse('forbidden', 403, headers)
    return handleDelete(env, table, cfg, url.searchParams, headers)
  }

  return errorResponse('method not allowed', 405, headers)
}

export { handleDbRequest }
