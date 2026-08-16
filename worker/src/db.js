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
//
// PATCH/DELETE are always admin-only regardless of insertAuth (mirrors the Postgres RLS,
// where map editors could only INSERT, never UPDATE/DELETE).

import { censorComment } from './profanity.js'

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
    columns: ['id', 'name', 'image_url', 'created_at', 'is_upgrade_scroll', 'is_seal', 'is_item', 'is_craftable', 'craft_yang_cost', 'is_pvp', 'is_pvp_only', 'category_tag', 'image_urls'],
    booleans: ['is_upgrade_scroll', 'is_seal', 'is_item', 'is_craftable', 'is_pvp', 'is_pvp_only'],
    jsonArrays: ['image_urls'],
    pk: ['id'],
  },
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
    columns: ['id', 'name', 'image_url', 'created_at', 'image_urls'],
    jsonArrays: ['image_urls'],
    pk: ['id'],
  },
  metin_drops: { columns: ['metin_id', 'material_id', 'quantity', 'alt_group'], pk: ['metin_id', 'material_id'] },
}

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

async function handlePost(env, table, cfg, request, searchParams, headers) {
  const body = await request.json().catch(function () { return null })
  if (body === null) return errorResponse('invalid JSON body', 400, headers)
  const rows = Array.isArray(body) ? body : [body]
  const nowIso = new Date().toISOString()
  const isUpsert = searchParams.get('upsert') === '1'

  const inserted = []
  for (let row of rows) {
    if (cfg.beforeInsert) {
      const result = cfg.beforeInsert(row)
      if (result.error) return errorResponse(result.error, 400, headers)
      row = result.row
    }
    const clean = rowToDb(cfg, row)
    if (cfg.columns.indexOf('id') !== -1 && !clean.id) clean.id = crypto.randomUUID()
    if (cfg.columns.indexOf('created_at') !== -1 && !clean.created_at) clean.created_at = nowIso

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

// PATCH/DELETE always require admin. POST authorization depends on cfg.insertAuth:
// 'admin' (default) -> admin only, 'editor' -> admin or map editor, 'public' -> no auth.
async function handleDbRequest(request, env, url, headers, isAdmin, isEditor) {
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
    return handlePost(env, table, cfg, request, url.searchParams, headers)
  }

  if (!(await isAdmin(request, env))) return errorResponse('forbidden', 403, headers)

  if (request.method === 'PATCH') return handlePatch(env, table, cfg, request, url.searchParams, headers)
  if (request.method === 'DELETE') return handleDelete(env, table, cfg, url.searchParams, headers)

  return errorResponse('method not allowed', 405, headers)
}

export { handleDbRequest }
