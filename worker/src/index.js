import { handleDbRequest } from './db.js'
import { handleRpcRequest } from './rpc.js'
import { handleAuthRequest, verifyToken, roleFlags } from './auth.js'
import { handleIconDbSearch, handleIconDbIcon, handleIconDbImport } from './icondb.js'

const BUCKETS = new Set(['images', 'map-notes'])
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 8 * 1024 * 1024
const DEV_ORIGINS = new Set(['http://localhost:5173', 'http://localhost:5174'])

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
  const allowed = (allowedOrigins.includes(origin) || DEV_ORIGINS.has(origin)) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  })
}

// Phase 3: own login system. Bearer token is now our own HMAC-signed session token
// (worker/src/auth.js), verified locally + checked against D1 admins/map_editors —
// no more network round trip to Supabase.
async function isAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const userId = await verifyToken(env, token)
  if (!userId) return false
  const flags = await roleFlags(env, userId)
  return flags.isAdmin
}

async function isEditor(request, env) {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const userId = await verifyToken(env, token)
  if (!userId) return false
  const flags = await roleFlags(env, userId)
  return flags.isEditor
}

function extFromType(type) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
  return map[type] || 'bin'
}

async function handleUpload(request, env, headers) {
  const form = await request.formData()
  const file = form.get('file')
  const bucket = form.get('bucket')

  if (!(file instanceof File)) return json({ error: 'missing file' }, 400, headers)
  if (!BUCKETS.has(bucket)) return json({ error: 'invalid bucket' }, 400, headers)
  if (!ALLOWED_TYPES.has(file.type)) return json({ error: 'unsupported file type' }, 400, headers)
  if (file.size > MAX_SIZE) return json({ error: 'file too large' }, 400, headers)

  if (bucket === 'images' && !(await isAdmin(request, env))) {
    return json({ error: 'forbidden' }, 403, headers)
  }

  const key = bucket + '/' + Date.now() + '-' + crypto.randomUUID() + '.' + extFromType(file.type)
  await env.IMAGES_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })

  return json({ url: env.PUBLIC_R2_URL + '/' + key }, 200, headers)
}

async function handleGetImage(request, env, pathname, headers) {
  const key = pathname.slice(1)
  const bucketName = key.split('/')[0]
  if (!BUCKETS.has(bucketName)) return json({ error: 'not found' }, 404, headers)

  const object = await env.IMAGES_BUCKET.get(key)
  if (!object) return json({ error: 'not found' }, 404, headers)

  const respHeaders = new Headers(headers)
  respHeaders.set('Content-Type', (object.httpMetadata && object.httpMetadata.contentType) || 'application/octet-stream')
  respHeaders.set('Cache-Control', 'public, max-age=31536000, immutable')
  if (object.httpEtag) respHeaders.set('ETag', object.httpEtag)
  return new Response(object.body, { headers: respHeaders })
}

async function handleDelete(request, env, headers) {
  if (!(await isAdmin(request, env))) return json({ error: 'forbidden' }, 403, headers)

  const body = await request.json().catch(() => null)
  const bucket = body && body.bucket
  const urls = (body && Array.isArray(body.urls)) ? body.urls : []
  if (!BUCKETS.has(bucket)) return json({ error: 'invalid bucket' }, 400, headers)

  // Accept URLs under either the current public base or the legacy r2.dev one,
  // since existing rows created before the switch to the worker-served base still use it.
  const bases = [env.PUBLIC_R2_URL, env.OLD_PUBLIC_R2_URL].filter(Boolean)
  const keys = []
  for (const u of urls) {
    if (typeof u !== 'string') continue
    for (const base of bases) {
      const prefix = base + '/' + bucket + '/'
      if (u.indexOf(prefix) === 0) { keys.push(u.slice(base.length + 1)); break }
    }
  }

  await Promise.all(keys.map(function (key) { return env.IMAGES_BUCKET.delete(key) }))
  return json({ ok: true, deleted: keys.length }, 200, headers)
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { headers: headers })

    const url = new URL(request.url)
    try {
      if (request.method === 'POST' && url.pathname === '/upload') return await handleUpload(request, env, headers)
      if (request.method === 'POST' && url.pathname === '/delete') return await handleDelete(request, env, headers)
      if (request.method === 'GET' && (url.pathname.indexOf('/images/') === 0 || url.pathname.indexOf('/map-notes/') === 0)) return await handleGetImage(request, env, url.pathname, headers)
      if (request.method === 'GET' && url.pathname === '/icondb/search') return await handleIconDbSearch(request, env, url, headers)
      if (request.method === 'GET' && url.pathname.indexOf('/icondb/icon/') === 0) return await handleIconDbIcon(request, env, url.pathname.slice('/icondb/icon/'.length), headers)
      if (request.method === 'POST' && url.pathname === '/icondb/import') return await handleIconDbImport(request, env, headers, isAdmin)
      if (url.pathname.indexOf('/db/') === 0) return await handleDbRequest(request, env, url, headers, isAdmin, isEditor)
      if (request.method === 'POST' && url.pathname.indexOf('/rpc/') === 0) return await handleRpcRequest(request, env, url, headers)
      if (url.pathname.indexOf('/auth/') === 0) return await handleAuthRequest(request, env, url, headers)
    } catch (err) {
      return json({ error: (err && err.message) || 'internal error' }, 500, headers)
    }

    return json({ error: 'not found' }, 404, headers)
  },
}
