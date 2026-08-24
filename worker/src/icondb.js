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
const CODE_RE = /^[A-Za-z0-9_-]{1,32}$/
// "Official" (searchable) index caps out at exactly 1000 icons total — verified by
// paging past it and getting zero hits back, not just meilisearch's estimate.
const OFFICIAL_TOTAL = 1000

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status: status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) })
}

async function searchOfficial(q) {
  const res = await fetch(MEILI_URL, {
    method: 'POST',
    headers: Object.assign({ 'Authorization': 'Bearer ' + MEILI_KEY, 'Content-Type': 'application/json' }, ICON_HEADERS),
    body: JSON.stringify({ q: q, limit: OFFICIAL_TOTAL }),
  })
  if (!res.ok) throw new Error('meilisearch request failed')
  const data = await res.json()
  return (data.hits || []).map(function (h) { return h.icon })
}

// The "unofficial" icon set (fan/client-asset dump, no names — browse only) has no
// search API. Its code list only exists baked into a hashed JS chunk on m2icondb's
// own site, and that hash changes on their redeploys, so instead of hardcoding a
// URL we resolve it fresh each time from their homepage: entry bundle -> chunk
// reference -> the chunk's own flat array literal. Result is cached at the edge for
// a day so normal picker use doesn't repeat this three-hop discovery every time.
async function fetchUnofficialCodes() {
  const homeRes = await fetch('https://m2icondb.com/', { headers: ICON_HEADERS })
  if (!homeRes.ok) throw new Error('m2icondb homepage unreachable')
  const home = await homeRes.text()
  const mainMatch = home.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/)
  if (!mainMatch) throw new Error('could not locate main bundle')

  const mainRes = await fetch('https://m2icondb.com' + mainMatch[1], { headers: ICON_HEADERS })
  if (!mainRes.ok) throw new Error('main bundle unreachable')
  const mainJs = await mainRes.text()
  const chunkMatch = mainJs.match(/assets\/unofficialIconsList-[A-Za-z0-9_-]+\.js/)
  if (!chunkMatch) throw new Error('could not locate unofficial-icons chunk')

  const chunkRes = await fetch('https://m2icondb.com/' + chunkMatch[0], { headers: ICON_HEADERS })
  if (!chunkRes.ok) throw new Error('unofficial-icons chunk unreachable')
  const chunkJs = await chunkRes.text()
  const arrMatch = chunkJs.match(/\[(?:"[0-9A-Za-z_]+",?)+\]/)
  if (!arrMatch) throw new Error('could not parse unofficial-icons list')

  return JSON.parse(arrMatch[0])
}

async function getUnofficialCodes() {
  const cache = caches.default
  const cacheKey = new Request('https://internal.icondb-cache/unofficial-codes')
  const cached = await cache.match(cacheKey)
  if (cached) return await cached.json()

  const codes = await fetchUnofficialCodes()
  const resp = new Response(JSON.stringify(codes), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=86400' } })
  await cache.put(cacheKey, resp.clone())
  return codes
}

async function handleIconDbSearch(request, env, url, headers) {
  const set = url.searchParams.get('set') === 'unofficial' ? 'unofficial' : 'official'
  const q = (url.searchParams.get('q') || '').trim()

  try {
    if (set === 'unofficial') {
      const all = await getUnofficialCodes()
      const codes = q ? all.filter(function (c) { return c.toLowerCase().indexOf(q.toLowerCase()) !== -1 }) : all
      return json({ codes: codes, total: codes.length }, 200, headers)
    }
    const codes = await searchOfficial(q)
    return json({ codes: codes, total: codes.length }, 200, headers)
  } catch (err) {
    return json({ error: (err && err.message) || 'icon database unreachable' }, 502, headers)
  }
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
