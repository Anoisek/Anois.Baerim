// Server-side port of the same nearest-teleport routing logic used in
// src/pages/DogTracker.jsx (graph built from admin-drawn path/wall strokes,
// walls block straight-line snapping/bridging). Duplicated rather than
// shared because the frontend and worker are separate JS bundles - kept
// deliberately small and dependency-free so the two stay easy to compare.

const BRIDGE_DIST = 1.5

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function segmentBlocked(a, b, walls) {
  for (const wall of walls) {
    for (let i = 0; i < wall.length - 1; i++) {
      if (segmentsIntersect(a, b, wall[i], wall[i + 1])) return true
    }
  }
  return false
}

function buildRouteGraph(strokes, walls) {
  const nodes = []
  const adj = []
  for (const stroke of strokes) {
    const ids = stroke.map(p => { nodes.push(p); adj.push([]); return nodes.length - 1 })
    for (let i = 0; i < ids.length - 1; i++) {
      const a = ids[i]
      const b = ids[i + 1]
      if (segmentBlocked(nodes[a], nodes[b], walls)) continue
      const d = dist(nodes[a], nodes[b])
      adj[a].push({ to: b, dist: d })
      adj[b].push({ to: a, dist: d })
    }
  }

  const grid = new Map()
  function cellOf(p) { return `${Math.floor(p.x / BRIDGE_DIST)}:${Math.floor(p.y / BRIDGE_DIST)}` }
  for (let i = 0; i < nodes.length; i++) {
    const key = cellOf(nodes[i])
    const bucket = grid.get(key)
    if (bucket) bucket.push(i)
    else grid.set(key, [i])
  }
  for (let i = 0; i < nodes.length; i++) {
    const cx = Math.floor(nodes[i].x / BRIDGE_DIST)
    const cy = Math.floor(nodes[i].y / BRIDGE_DIST)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`)
        if (!bucket) continue
        for (const j of bucket) {
          if (j <= i) continue
          const d = dist(nodes[i], nodes[j])
          if (d <= BRIDGE_DIST && !segmentBlocked(nodes[i], nodes[j], walls)) {
            adj[i].push({ to: j, dist: d })
            adj[j].push({ to: i, dist: d })
          }
        }
      }
    }
  }
  return { nodes, adj }
}

function nearestGraphNode(nodes, point, walls) {
  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < nodes.length; i++) {
    if (segmentBlocked(point, nodes[i], walls)) continue
    const d = dist(nodes[i], point)
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  if (bestIdx === -1) return null
  return { idx: bestIdx, dist: bestDist }
}

function shortestDistancesFrom(adj, startIdx) {
  const dists = new Array(adj.length).fill(Infinity)
  const visited = new Array(adj.length).fill(false)
  dists[startIdx] = 0
  for (let iter = 0; iter < adj.length; iter++) {
    let u = -1
    let best = Infinity
    for (let i = 0; i < adj.length; i++) {
      if (!visited[i] && dists[i] < best) { best = dists[i]; u = i }
    }
    if (u === -1) break
    visited[u] = true
    for (const edge of adj[u]) {
      if (dists[u] + edge.dist < dists[edge.to]) dists[edge.to] = dists[u] + edge.dist
    }
  }
  return dists
}

function nearestTeleport(point, graph, teleports, walls) {
  if (teleports.length === 0) return null

  if (graph.nodes.length > 0) {
    const entry = nearestGraphNode(graph.nodes, point, walls)
    if (entry) {
      const distances = shortestDistancesFrom(graph.adj, entry.idx)
      let best = null
      let bestTotal = Infinity
      for (const tp of teleports) {
        const tpEntry = nearestGraphNode(graph.nodes, tp, walls)
        if (!tpEntry || !Number.isFinite(distances[tpEntry.idx])) continue
        const total = entry.dist + distances[tpEntry.idx] + tpEntry.dist
        if (total < bestTotal) { bestTotal = total; best = tp }
      }
      if (best) return best
    }
  }

  let best = null
  let bestDist = Infinity
  for (const tp of teleports) {
    if (segmentBlocked(point, tp, walls)) continue
    const d = dist(point, tp)
    if (d < bestDist) { bestDist = d; best = tp }
  }
  return best
}

export { buildRouteGraph, nearestTeleport }
