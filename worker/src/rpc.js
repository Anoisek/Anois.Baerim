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

async function handleRpcRequest(request, env, url, headers) {
  const parts = url.pathname.split('/').filter(Boolean) // ['rpc', ':name']
  const name = parts[1]
  const params = await request.json().catch(function () { return {} })

  if (name === 'submit_material_price') return submitMaterialPrice(env, params, headers)

  return json({ data: null, error: { message: 'unknown rpc: ' + name } }, 404, headers)
}

export { handleRpcRequest }
