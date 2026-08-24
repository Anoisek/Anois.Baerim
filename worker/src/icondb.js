// Proxy to m2icondb.com's public icon database, used by the admin "pick from icon
// database" picker (IconDbPicker.jsx) on item/material edit forms. Requests are
// proxied server-side (not called directly from the browser) because m2icondb's
// Cloudflare WAF only lets requests through that carry its own Origin/Referer, which
// a real cross-origin browser fetch from our own site could never send.
const MEILI_URL = 'https://meilisearch.m2icondb.com/indexes/en/search'
// Public search-only key, taken from m2icondb.com's own client bundle — not a secret,
// scoped to read-only search on their "official icons" index.
const MEILI_KEY = '6d5751f0a9814dd778d5623a30b258de7000ed8676c0922a4c0ef8928945de79'
const ICON_HEADERS = {
  'Origin': 'https://m2icondb.com',
  'Referer': 'https://m2icondb.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
}
const CODE_RE = /^[A-Za-z0-9_-]{1,24}$/

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status: status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) })
}

async function handleIconDbSearch(request, env, url, headers) {
  const q = url.searchParams.get('q') || ''
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0)
  const limit = Math.min(96, Math.max(1, parseInt(url.searchParams.get('limit') || '48', 10) || 48))

  let res
  try {
    res = await fetch(MEILI_URL, {
      method: 'POST',
      headers: Object.assign({ 'Authorization': 'Bearer ' + MEILI_KEY, 'Content-Type': 'application/json' }, ICON_HEADERS),
      body: JSON.stringify({ q: q, offset: offset, limit: limit }),
    })
  } catch {
    return json({ error: 'icon database unreachable' }, 502, headers)
  }
  if (!res.ok) return json({ error: 'search failed' }, 502, headers)
  const data = await res.json()
  return json({ codes: (data.hits || []).map(function (h) { return h.icon }), total: data.estimatedTotalHits ?? 0 }, 200, headers)
}

async function handleIconDbIcon(request, env, code, headers) {
  if (!CODE_RE.test(code)) return new Response('bad code', { status: 400, headers: headers })
  let res
  try {
    res = await fetch('https://img.m2icondb.com/' + code + '.png', { headers: ICON_HEADERS })
  } catch {
    return new Response('icon database unreachable', { status: 502, headers: headers })
  }
  if (!res.ok) return new Response('not found', { status: 404, headers: headers })
  const buf = await res.arrayBuffer()
  return new Response(buf, { status: 200, headers: Object.assign({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800, immutable' }, headers) })
}

// Admin-only: fetches the chosen icon from m2icondb and re-hosts it in our own R2
// bucket (same pattern as a normal upload), so the site never depends on a third
// party's image server for a live item/material icon.
async function handleIconDbImport(request, env, headers, isAdmin) {
  if (!(await isAdmin(request, env))) return json({ error: 'forbidden' }, 403, headers)

  const body = await request.json().catch(function () { return null })
  const code = body && body.code
  if (!code || !CODE_RE.test(code)) return json({ error: 'missing/invalid code' }, 400, headers)

  let res
  try {
    res = await fetch('https://img.m2icondb.com/' + code + '.png', { headers: ICON_HEADERS })
  } catch {
    return json({ error: 'icon database unreachable' }, 502, headers)
  }
  if (!res.ok) return json({ error: 'icon not found on m2icondb' }, 404, headers)
  const buf = await res.arrayBuffer()

  const key = 'images/' + Date.now() + '-' + crypto.randomUUID() + '.png'
  await env.IMAGES_BUCKET.put(key, buf, { httpMetadata: { contentType: 'image/png' } })

  return json({ url: env.PUBLIC_R2_URL + '/' + key }, 200, headers)
}

export { handleIconDbSearch, handleIconDbIcon, handleIconDbImport }
