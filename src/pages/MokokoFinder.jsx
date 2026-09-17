import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Spinner from '../components/Spinner'
import MokokoFinderReportModal from '../components/MokokoFinderReportModal'
import MokokoFinderReviewModal from '../components/MokokoFinderReviewModal'
import { db } from '../dbClient'
import { deleteImages } from '../utils/imageStorage'

// Only one map for now - no new maps to dedicate to this yet, so it borrows
// an existing one for testing (see mokoko_finder_reports/spots in db.js,
// which already validate against this same name).
const MOKOKO_FINDER_MAP_NAME = 'Yongan'
// Same shape as OreFinder's poll: paused on a hidden tab so this doesn't add
// to the worker's shared daily request budget.
const POLL_MS = 20000

// /mokoko-finder (admin-only while testing, see MokokoFinderLink): works like
// Dog Tracker's click-to-report, but instead of appearing live it goes into
// an admin review queue with a screenshot as proof (like Ore Finder's manual
// add) - only after approval does it show up on the map with the mokoko icon
// from the interactive map.
export default function MokokoFinder() {
  const { isAdmin } = useAuth()
  const [map, setMap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [spots, setSpots] = useState([])
  const [pendingClick, setPendingClick] = useState(null)
  const [sending, setSending] = useState(false)
  const [hoverPos, setHoverPos] = useState(null)
  const [confirmSpot, setConfirmSpot] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const mapWrapRef = useRef(null)

  useEffect(() => {
    db.from('maps').select('*').eq('name', MOKOKO_FINDER_MAP_NAME).maybeSingle().then(({ data }) => {
      setMap(data)
      setLoading(false)
    })
  }, [])

  function loadSpots() {
    db.from('mokoko_finder_spots').select('*').eq('map', MOKOKO_FINDER_MAP_NAME).then(({ data }) => {
      setSpots(data ?? [])
    })
  }

  function loadReportCount() {
    if (!isAdmin) return
    db.from('mokoko_finder_reports').select('id', { count: 'exact', head: true }).eq('map', MOKOKO_FINDER_MAP_NAME).then(({ count }) => {
      setReportCount(count ?? 0)
    })
  }

  useEffect(() => {
    loadSpots()
    loadReportCount()
    function poll() {
      if (document.visibilityState !== 'visible') return
      loadSpots()
      loadReportCount()
    }
    const intervalId = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  function handleMapClick(e) {
    if (!mapWrapRef.current || !map) return
    const rect = mapWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos(null)
    setPendingClick({ x, y })
  }

  function handleMapMouseMove(e) {
    if (!mapWrapRef.current) return
    const rect = mapWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos({ x, y, clientX: e.clientX, clientY: e.clientY })
  }

  async function handleReportSubmit(x, y, screenshotUrl, turnstileToken) {
    setSending(true)
    const { error } = await db
      .from('mokoko_finder_reports')
      .insert({ map: MOKOKO_FINDER_MAP_NAME, x, y, screenshot_url: screenshotUrl, turnstileToken })
    setSending(false)
    if (error) {
      alert('Nie udało się wysłać zgłoszenia: ' + error.message)
      return
    }
    setPendingClick(null)
    loadReportCount()
  }

  function handleApproved(spot) {
    setSpots(prev => [...prev, spot])
  }

  async function handleRemoveSpot() {
    if (!confirmSpot) return
    const spot = confirmSpot
    setConfirmSpot(null)
    setSpots(prev => prev.filter(s => s.id !== spot.id))
    await db.from('mokoko_finder_spots').delete().eq('id', spot.id)
    await deleteImages(spot.screenshot_url, 'map-notes')
  }

  if (!isAdmin) {
    return (
      <div className="text-white min-h-screen flex flex-col">
        <Navbar hideBanner />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-600 mb-2">404</p>
            <p className="text-gray-500 text-sm">Ta strona nie istnieje.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="text-white min-h-screen flex flex-col">
      <Navbar hideBanner />
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
        <h1 className="text-2xl font-extrabold tracking-wide text-yellow-400">🍀 MOKOKO FINDER</h1>
        <p className="text-xs text-gray-500 -mt-2 text-center max-w-sm">
          Testowa mapa ({MOKOKO_FINDER_MAP_NAME}) - docelowo pojawi się tu dedykowana mapa.
        </p>

        <button
          onClick={() => setReviewOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200"
        >
          🛡️ Zgłoszenia do przeglądu{reportCount > 0 ? ` (${reportCount})` : ''}
        </button>

        {loading ? (
          <Spinner />
        ) : !map ? (
          <p className="text-gray-500 text-sm p-6">Mapa testowa nie znaleziona.</p>
        ) : (
          <div
            ref={mapWrapRef}
            onClick={handleMapClick}
            onMouseMove={handleMapMouseMove}
            onMouseLeave={() => setHoverPos(null)}
            className="relative inline-block cursor-crosshair"
          >
            <img
              src={map.image_url}
              alt={map.name}
              draggable="false"
              className="block max-w-full max-h-[75vh] object-contain select-none"
            />
            {spots.map(spot => (
              <button
                key={spot.id}
                onClick={e => { e.stopPropagation(); setConfirmSpot(spot) }}
                title="Kliknij, aby usunąć"
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform"
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              >
                <img src="/mokoko.png" alt="" draggable="false" className="w-8 h-8 object-contain drop-shadow select-none" />
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-yellow-400">Kliknij na mapę, aby zgłosić mokoko.</p>
      </div>

      {hoverPos && map && !pendingClick && (
        <div
          className="fixed z-20 pointer-events-none rounded-md border border-gray-600 bg-gray-900/90 px-2 py-1 text-[11px] font-mono text-gray-100 shadow-lg whitespace-nowrap"
          style={{ left: hoverPos.clientX + 14, top: hoverPos.clientY + 14 }}
        >
          X: {Math.round((hoverPos.x / 100) * map.width)} Y: {Math.round((hoverPos.y / 100) * map.height)}
        </div>
      )}

      {pendingClick && map && (
        <MokokoFinderReportModal
          map={map}
          initialX={(pendingClick.x / 100) * map.width}
          initialY={(pendingClick.y / 100) * map.height}
          onClose={() => setPendingClick(null)}
          onSubmit={handleReportSubmit}
          sending={sending}
        />
      )}

      {reviewOpen && map && (
        <MokokoFinderReviewModal
          map={map}
          onClose={() => { setReviewOpen(false); loadReportCount() }}
          onApproved={handleApproved}
        />
      )}

      {confirmSpot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmSpot(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72 flex flex-col items-center gap-4 shadow-xl shadow-black/50"
          >
            <p className="text-lg font-bold text-gray-100 text-center">Usunąć tego mokoko?</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleRemoveSpot}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-colors"
              >
                Usuń
              </button>
              <button
                onClick={() => setConfirmSpot(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
