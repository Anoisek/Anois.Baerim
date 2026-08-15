// Phase 3: own login system, replacing Supabase Auth. PBKDF2 password hashing,
// stateless HMAC-signed session tokens (no session table in D1) — both via the
// Worker runtime's native Web Crypto, no external library needed.

const PBKDF2_ITERATIONS = 100000
const TOKEN_TTL_SECONDS = 30 * 24 * 3600

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
  })
}

function toBase64Url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derivePbkdf2(password, saltBytes) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return toBase64Url(new Uint8Array(bits))
}

async function hashNewPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePbkdf2(password, saltBytes)
  return { hash: hash, salt: toBase64Url(saltBytes) }
}

async function verifyPassword(password, expectedHash, saltB64) {
  const computed = await derivePbkdf2(password, fromBase64Url(saltB64))
  if (computed.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i)
  return diff === 0
}

async function getSigningKey(env) {
  const enc = new TextEncoder()
  return crypto.subtle.importKey('raw', enc.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function issueToken(env, userId) {
  const payload = { sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await getSigningKey(env)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  return payloadB64 + '.' + toBase64Url(new Uint8Array(sig))
}

// Returns the user id if the token is validly signed and unexpired, else null.
// Never throws — any malformed input (bad base64, wrong part count, etc.) just
// resolves to null so callers can treat it as a clean 401 instead of a 500.
async function verifyToken(env, token) {
  try {
    if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const payloadB64 = parts[0]
    const sigB64 = parts[1]

    const key = await getSigningKey(env)
    const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(sigB64), new TextEncoder().encode(payloadB64))
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)))
    if (!payload || !payload.sub || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.sub
  } catch (e) {
    return null
  }
}

function bearerToken(request) {
  const authHeader = request.headers.get('Authorization') || ''
  return authHeader.replace(/^Bearer\s+/i, '')
}

async function roleFlags(env, userId) {
  const [adminRow, editorRow] = await Promise.all([
    env.DB.prepare('SELECT user_id FROM admins WHERE user_id = ?').bind(userId).first(),
    env.DB.prepare('SELECT user_id FROM map_editors WHERE user_id = ?').bind(userId).first(),
  ])
  return { isAdmin: !!adminRow, isEditor: !!editorRow }
}

async function handleLogin(request, env, headers) {
  const body = await request.json().catch(function () { return null })
  const username = body && body.username
  const password = body && body.password
  if (!username || !password) return json({ error: 'missing credentials' }, 400, headers)

  const user = await env.DB.prepare('SELECT id, password_hash, password_salt FROM users WHERE username = ?').bind(username).first()
  if (!user) return json({ error: 'invalid credentials' }, 401, headers)

  const ok = await verifyPassword(password, user.password_hash, user.password_salt)
  if (!ok) return json({ error: 'invalid credentials' }, 401, headers)

  const token = await issueToken(env, user.id)
  const flags = await roleFlags(env, user.id)
  return json(Object.assign({ token: token }, flags), 200, headers)
}

async function handleMe(request, env, headers) {
  const userId = await verifyToken(env, bearerToken(request))
  if (!userId) return json({ error: 'unauthorized' }, 401, headers)
  const flags = await roleFlags(env, userId)
  return json(flags, 200, headers)
}

async function handleChangePassword(request, env, headers) {
  const userId = await verifyToken(env, bearerToken(request))
  if (!userId) return json({ error: 'unauthorized' }, 401, headers)

  const body = await request.json().catch(function () { return null })
  const currentPassword = body && body.currentPassword
  const newPassword = body && body.newPassword
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return json({ error: 'new password must be at least 8 characters' }, 400, headers)
  }

  const user = await env.DB.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').bind(userId).first()
  if (!user) return json({ error: 'unauthorized' }, 401, headers)

  const ok = await verifyPassword(currentPassword, user.password_hash, user.password_salt)
  if (!ok) return json({ error: 'current password is incorrect' }, 400, headers)

  const next = await hashNewPassword(newPassword)
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(next.hash, next.salt, userId).run()
  return json({ ok: true }, 200, headers)
}

async function handleAuthRequest(request, env, url, headers) {
  const path = url.pathname
  if (request.method === 'POST' && path === '/auth/login') return handleLogin(request, env, headers)
  if (request.method === 'GET' && path === '/auth/me') return handleMe(request, env, headers)
  if (request.method === 'POST' && path === '/auth/change-password') return handleChangePassword(request, env, headers)
  return json({ error: 'not found' }, 404, headers)
}

export { handleAuthRequest, verifyToken, hashNewPassword, roleFlags }
