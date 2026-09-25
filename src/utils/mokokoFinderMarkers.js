import { db } from '../dbClient'

// Approved /mokoko-finder spots are mirrored onto the interactive map: the
// maps row with the same name gets a regular mokoko marker (same icon/title
// convention as AddMarkerModal), and every proof screenshot is attached as a
// comment on it. The spot keeps the marker's id (mokoko_finder_spots.marker_id)
// so deleting the spot removes the marker too.
const MARKER_ICON = '/mokoko.png'
export const FINDER_NOTE_COMMENT = '📸 Mokoko Finder'

function nextMokokoNumber(markers) {
  const used = new Set()
  for (const m of markers) {
    const match = /^Mokoko #(\d+)/.exec(m.title ?? '')
    if (match) used.add(Number(match[1]))
  }
  let n = 1
  while (used.has(n)) n++
  return n
}

// x/y are the spot's percentages (0-100). Returns the new marker id, or null
// when the map isn't on the interactive map (nothing to mirror to).
export async function createMarkerForSpot(mapName, x, y, screenshotUrls) {
  const { data: map } = await db.from('maps').select('id, width, height').eq('name', mapName).maybeSingle()
  if (!map) return null
  const { data: markers } = await db.from('map_markers').select('title').eq('map_id', map.id)
  const { data: marker, error } = await db
    .from('map_markers')
    .insert({
      map_id: map.id,
      x: Math.round((x / 100) * map.width),
      y: Math.round((y / 100) * map.height),
      icon: MARKER_ICON,
      title: `Mokoko #${nextMokokoNumber(markers ?? [])}`,
    })
    .select()
    .single()
  if (error) throw error
  for (const url of screenshotUrls) {
    await db.from('map_marker_notes').insert({ marker_id: marker.id, comment: FINDER_NOTE_COMMENT, image_url: url })
  }
  return marker.id
}

// Screenshots are shared with the spot, so the caller deletes the images.
export async function deleteMarkerForSpot(markerId) {
  if (!markerId) return
  await db.from('map_marker_notes').delete().eq('marker_id', markerId)
  await db.from('map_markers').delete().eq('id', markerId)
}
