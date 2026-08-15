import { getToken } from './authClient'

const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL

function authHeader() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

class QueryBuilder {
  constructor(table) {
    this.table = table
    this.method = 'GET'
    this.params = new URLSearchParams()
    this.body = null
    this.singleMode = null
  }

  select(cols, opts) {
    if (cols) this.params.set('select', cols)
    if (opts?.count === 'exact') this.params.set('count', 'exact')
    if (opts?.head) this.params.set('head', '1')
    return this
  }

  eq(col, val) { this.params.append(col, `eq.${val}`); return this }
  neq(col, val) { this.params.append(col, `neq.${val}`); return this }
  is(col, val) { this.params.append(col, `is.${val}`); return this }
  ilike(col, val) { this.params.append(col, `ilike.${val}`); return this }
  order(col, opts) { this.params.set('order', `${col}.${opts?.ascending === false ? 'desc' : 'asc'}`); return this }
  limit(n) { this.params.set('limit', String(n)); return this }
  single() { this.singleMode = 'single'; return this }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this }

  insert(rows) { this.method = 'POST'; this.body = rows; return this }
  update(patch) { this.method = 'PATCH'; this.body = patch; return this }
  upsert(row) { this.method = 'POST'; this.body = row; this.params.set('upsert', '1'); return this }
  delete() { this.method = 'DELETE'; return this }

  async _exec() {
    const headers = { ...(await authHeader()) }
    let body
    if (this.body !== null && (this.method === 'POST' || this.method === 'PATCH')) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(this.body)
    }

    const url = `${WORKER_URL}/db/${this.table}?${this.params.toString()}`
    let res
    try {
      res = await fetch(url, { method: this.method, headers, body })
    } catch (err) {
      return { data: null, error: { message: err.message } }
    }

    const json = await res.json().catch(() => ({ data: null, error: { message: 'invalid response' } }))
    if (!res.ok && !json.error) json.error = { message: `HTTP ${res.status}` }

    if (this.singleMode) {
      const rows = Array.isArray(json.data) ? json.data : json.data ? [json.data] : []
      if (this.singleMode === 'single' && rows.length !== 1) {
        return { data: null, error: json.error || { message: 'expected exactly one row' } }
      }
      return { data: rows[0] ?? null, error: json.error ?? null }
    }

    return json
  }

  then(resolve, reject) { return this._exec().then(resolve, reject) }
  catch(reject) { return this._exec().catch(reject) }
}

async function rpc(name, params) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
  const res = await fetch(`${WORKER_URL}/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params ?? {}),
  })
  const json = await res.json().catch(() => ({ data: null, error: { message: 'invalid response' } }))
  if (!res.ok && !json.error) json.error = { message: `HTTP ${res.status}` }
  return json
}

export const db = {
  from(table) { return new QueryBuilder(table) },
  rpc,
}
