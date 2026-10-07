import { useState } from 'react'
import { db } from '../dbClient'
import { createMarkerForSpot, deleteMarkerForSpot } from '../utils/mokokoFinderMarkers'
import { gameToPct, pctToGame, gameRange } from '../utils/mokokoFinderCoords'
import useEscapeKey from '../utils/useEscapeKey'

// Admin-only: an unverified "ghost" mokoko (red on the map, see
// mokoko_finder_ghosts). Approving works like approving a report in
// MokokoFinderReviewModal - the admin can fix the exact X/Y, it becomes a
// regular mokoko_finder_spots row (no screenshot) and is mirrored onto the
// interactive map - and the ghost is deleted. Deleting just drops the ghost.
export default function MokokoFinderGhostModal({ map, ghost, onClose, onApproved, onDeleted }) {
  const start = pctToGame(map, ghost.x, ghost.y)
  const [xInput, setXInput] = useState(String(Math.round(start.x)))
  const [yInput, setYInput] = useState(String(Math.round(start.y)))
  const [busy, setBusy] = useState(false)
  useEscapeKey(() => !busy && onClose())

  async function handleApprove() {
    const xNum = Number(xInput)
    const yNum = Number(yInput)
    const [minX, maxX] = gameRange(map, 'x')
    const [minY, maxY] = gameRange(map, 'y')
    if (xInput === '' || !Number.isFinite(xNum) || xNum < Math.floor(minX) || xNum > Math.ceil(maxX)) return
    if (yInput === '' || !Number.isFinite(yNum) || yNum < Math.floor(minY) || yNum > Math.ceil(maxY)) return

    setBusy(true)
    const { x, y } = gameToPct(map, xNum, yNum)
    let markerId = null
    try {
      markerId = await createMarkerForSpot(map.name, x, y, xNum, yNum, [])
    } catch (err) {
      alert(`Could not approve: ${err.message}`)
      setBusy(false)
      return
    }
    const { data: spot, error } = await db
      .from('mokoko_finder_spots')
      .insert({ map: map.name, x, y, screenshot_url: '', marker_id: markerId })
      .select()
      .single()
    if (error) {
      await deleteMarkerForSpot(markerId)
      alert(`Could not approve: ${error.message}`)
      setBusy(false)
      return
    }
    await db.from('mokoko_finder_ghosts').delete().eq('id', ghost.id)
    setBusy(false)
    onApproved(ghost, spot)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this ghost mokoko?')) return
    setBusy(true)
    const { error } = await db.from('mokoko_finder_ghosts').delete().eq('id', ghost.id)
    setBusy(false)
    if (error) {
      alert(`Could not delete: ${error.message}`)
      return
    }
    onDeleted(ghost)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-red-500/60 rounded-2xl p-6 w-80 flex flex-col gap-3 shadow-xl shadow-black/50"
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-extrabold text-red-400 tracking-wide">👻 Ghost mokoko</p>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-gray-400">
          Unverified - only you see it. Approve to add it as a real mokoko (also on the interactive map).
        </p>
        {ghost.note && (
          <p className="text-sm text-gray-100 bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
            {ghost.note}
          </p>
        )}
        <p className="text-[11px] text-gray-500">Added {new Date(ghost.created_at).toLocaleString()}</p>
        <div className="grid grid-cols-2 gap-3">
          {[['X', xInput, setXInput], ['Y', yInput, setYInput]].map(([label, value, setValue]) => (
            <label key={label} className="flex flex-col gap-1 text-xs text-gray-400">
              {label}
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={busy}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition-colors"
          >
            Delete
          </button>
          <button
            onClick={handleApprove}
            disabled={busy}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-gray-950 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
