// A marker's own entry in `collected` (localStorage) always wins if present, even if it's
// explicitly false. Only falls back to the marker it was copied from (see `copied_from`,
// used when duplicating a map's markers) when this marker has no entry of its own yet.
export function isMarkerCollected(marker, collected) {
  if (Object.prototype.hasOwnProperty.call(collected, marker.id)) return !!collected[marker.id]
  if (marker.copied_from && Object.prototype.hasOwnProperty.call(collected, marker.copied_from)) {
    return !!collected[marker.copied_from]
  }
  return false
}
