import { useEffect, useState } from 'react'
import { db } from '../dbClient'
import { deleteImages } from '../utils/imageStorage'

function formatTime(iso) {
  return new Date(iso).toLocaleString()
}

// Admin-only review queue for /mokoko-finder reports. Approving copies the
// report into mokoko_finder_spots (permanent, shown on the map) and deletes
// the report row; rejecting just deletes it (and its screenshot). Not
// translated - same convention as OreFinderAdminLogModal/DogTracker, this is
// Bartek's own tooling, never shown to regular visitors.
export default function MokokoFinderReviewModal({ map, onClose, onApproved }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [zoomUrl, setZoomUrl] = useState(null)

  useEffect(() => {
    db.from('mokoko_finder_reports').select('*').eq('map', map.name).order('created_at').then(({ data }) => {
      setReports(data ?? [])
      setLoading(false)
    })
  }, [map.name])

  async function handleApprove(report) {
    setBusyId(report.id)
    const { data, error } = await db
      .from('mokoko_finder_spots')
      .insert({ map: report.map, x: report.x, y: report.y, screenshot_url: report.screenshot_url })
      .select()
      .single()
    if (error) {
      alert('Nie udało się zatwierdzić: ' + error.message)
      setBusyId(null)
      return
    }
    await db.from('mokoko_finder_reports').delete().eq('id', report.id)
    setReports(prev => prev.filter(r => r.id !== report.id))
    setBusyId(null)
    onApproved(data)
  }

  async function handleReject(report) {
    setBusyId(report.id)
    await db.from('mokoko_finder_reports').delete().eq('id', report.id)
    await deleteImages(report.screenshot_url, 'map-notes')
    setReports(prev => prev.filter(r => r.id !== report.id))
    setBusyId(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl flex flex-col gap-4 shadow-xl shadow-black/50 max-h-[85vh]"
      >
        <div className="flex items-center justify-between">
          <p className="text-xl font-extrabold text-yellow-400 tracking-wide">🍀 Zgłoszenia mokoko (admin)</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Ładowanie...</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-500">Brak oczekujących zgłoszeń.</p>
        ) : (
          <div className="overflow-y-auto flex-1 -mx-2 px-2 flex flex-col gap-2">
            {reports.map(report => {
              const px = Math.round((report.x / 100) * map.width)
              const py = Math.round((report.y / 100) * map.height)
              const busy = busyId === report.id
              return (
                <div
                  key={report.id}
                  className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-xl p-2.5"
                >
                  <button onClick={() => setZoomUrl(report.screenshot_url)} className="shrink-0">
                    <img
                      src={report.screenshot_url}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg border border-gray-600"
                    />
                  </button>
                  <div className="flex-1 min-w-0 text-xs text-gray-300">
                    <p className="font-mono font-semibold text-gray-100">X: {px} Y: {py}</p>
                    <p className="text-gray-500">{formatTime(report.created_at)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleReject(report)}
                      disabled={busy}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition-colors"
                    >
                      Odrzuć
                    </button>
                    <button
                      onClick={() => handleApprove(report)}
                      disabled={busy}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-gray-950 transition-colors"
                    >
                      Zatwierdź
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {zoomUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={e => { e.stopPropagation(); setZoomUrl(null) }}
        >
          <img src={zoomUrl} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
