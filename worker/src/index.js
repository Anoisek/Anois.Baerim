const BUCKETS = new Set(['images', 'map-notes'])
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 8 * 1024 * 1024
const DEV_ORIGINS = new Set(['http://localhost:5173', 'http://localhost:5174'])

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const allowed = (origin === env.ALLOWED_ORIGIN || DEV_ORIGINS.has(origin)) ? origin : env.ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  })
}

async function isAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return false

  const userRes = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + token, apikey: env.SUPABASE_ANON_KEY },
  })
  if (!userRes.ok) return false
  const user = await userRes.json()
  if (!user || !user.id) return false

  const adminRes = await fetch(
    env.SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + user.id + '&select=user_id',
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } }
  )
  if (!adminRes.ok) return false
  const rows = await adminRes.json()
  return rows.length > 0
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

async function handleDelete(request, env, headers) {
  if (!(await isAdmin(request, env))) return json({ error: 'forbidden' }, 403, headers)

  const body = await request.json().catch(() => null)
  const bucket = body && body.bucket
  const urls = (body && Array.isArray(body.urls)) ? body.urls : []
  if (!BUCKETS.has(bucket)) return json({ error: 'invalid bucket' }, 400, headers)

  const prefix = env.PUBLIC_R2_URL + '/' + bucket + '/'
  const keys = urls
    .filter(function (u) { return typeof u === 'string' && u.indexOf(prefix) === 0 })
    .map(function (u) { return u.slice(env.PUBLIC_R2_URL.length + 1) })

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
    } catch (err) {
      return json({ error: (err && err.message) || 'internal error' }, 500, headers)
    }

    return json({ error: 'not found' }, 404, headers)
  },
}
