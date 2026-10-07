// /mokoko-finder spots are stored as percentages of the map image (0-100);
// players see in-game X/Y. map.game = the in-game coordinates at the image's
// edges ({ x: [left, right], y: [top, bottom] }) - defaults to 0..width/height.
//
// In-game X/Y at the image edges per map name - shared by /mokoko-finder and
// the interactive map (same image). Thunder Mountains is calibrated from 3
// in-game points matched by hand to the image: (482, 1534), (1102, 1395)
// (Mokoko #20/#21) and (982, 1385) - the image covers 1920 in-game units,
// not 0-2048. Maps not listed here use 0..width/height.
export const MAP_GAME_COORDS = {
  'Thunder Mountains': { x: [8.4, 1928.4], y: [19.6, 1939.6] },
}

function range(map, axis) {
  const game = map.game ?? MAP_GAME_COORDS[map.name]
  return game?.[axis] ?? [0, axis === 'x' ? map.width : map.height]
}

// In-game X/Y range the map covers on one axis, low..high - for validating typed coordinates.
export function gameRange(map, axis) {
  const [a, b] = range(map, axis)
  return [Math.min(a, b), Math.max(a, b)]
}

// Admin calibration points (mokoko_finder_calibration rows: x/y = image %,
// game_x/game_y = in-game X/Y read off at that spot) -> map.game edges.
// Per axis a least-squares line game = a + b * pct; with a single point (or
// all points at the same %) only the offset is shifted and the scale is
// kept from `fallback` (the current edges). Returns null with no points.
export function fitGameCoords(map, points) {
  if (!points?.length) return null
  const fit = (axis, pctKey, gameKey) => {
    const [f0, f1] = range(map, axis)
    const n = points.length
    const mp = points.reduce((s, p) => s + p[pctKey], 0) / n
    const mg = points.reduce((s, p) => s + p[gameKey], 0) / n
    const spp = points.reduce((s, p) => s + (p[pctKey] - mp) ** 2, 0)
    const b = spp > 1 ? points.reduce((s, p) => s + (p[pctKey] - mp) * (p[gameKey] - mg), 0) / spp : (f1 - f0) / 100
    const a = mg - b * mp
    return [a, a + 100 * b]
  }
  return { x: fit('x', 'x', 'game_x'), y: fit('y', 'y', 'game_y') }
}

// Kept 1% inside the edge - a marker at exactly 0/100% gets clipped by the map frame.
const clampPct = v => Math.min(99, Math.max(1, v))

// Clamped to the image, so a typed X/Y just past its edge lands on the edge.
export function gameToPct(map, gx, gy) {
  const [x0, x1] = range(map, 'x')
  const [y0, y1] = range(map, 'y')
  return { x: clampPct(((gx - x0) / (x1 - x0)) * 100), y: clampPct(((gy - y0) / (y1 - y0)) * 100) }
}

export function pctToGame(map, x, y) {
  const [x0, x1] = range(map, 'x')
  const [y0, y1] = range(map, 'y')
  return { x: x0 + (x / 100) * (x1 - x0), y: y0 + (y / 100) * (y1 - y0) }
}

// Interactive map: marker x/y are pixels of the map image (0..width/height).
export function mapPixelToGame(map, px, py) {
  return pctToGame(map, (px / map.width) * 100, (py / map.height) * 100)
}
