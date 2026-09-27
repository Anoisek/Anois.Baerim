// /mokoko-finder spots are stored as percentages of the map image (0-100);
// players see in-game X/Y. map.game = the in-game coordinates at the image's
// edges ({ x: [left, right], y: [top, bottom] }) - defaults to 0..width/height.
function range(map, axis) {
  return map.game?.[axis] ?? [0, axis === 'x' ? map.width : map.height]
}

const clampPct = v => Math.min(100, Math.max(0, v))

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
