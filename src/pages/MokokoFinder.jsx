import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import MokokoFinderReportModal from '../components/MokokoFinderReportModal'
import MokokoFinderReviewModal from '../components/MokokoFinderReviewModal'
import MokokoFinderSpotModal from '../components/MokokoFinderSpotModal'
import { db } from '../dbClient'

// Only this one map actually has report/spot data for now - no new map to
// dedicate to this yet, so it borrows an existing one for testing (see
// mokoko_finder_reports/spots in worker/src/db.js, which validate against
// this same name). The map tab list itself still lists every map, same look
// as the interactive map, so the layout is ready once more maps are wired in.
const SUPPORTED_MAPS = new Set(['Yongan'])
// Same shape as OreFinder's poll: paused on a hidden tab so this doesn't add
// to the worker's shared daily request budget.
const POLL_MS = 20000

// /mokoko-finder (admin-only while testing, see MokokoFinderLink): works like
// Dog Tracker's click-to-report, but instead of appearing live it goes into
// an admin review queue with a screenshot as proof (like Ore Finder's manual
// add) - only after approval does it show up on the map with the mokoko icon
// from the interactive map. The admin can merge several reports of the same
// sighting into one spot (see MokokoFinderReviewModal).
export default function MokokoFinder() {
  const { isAdmin } = useAuth()
  const [maps, setMaps] = useState([])
  const [mapsLoading, setMapsLoading] = useState(true)
  const [selectedName, setSelectedName] = useState('Yongan')
  const [spots, setSpots] = useState([])
  const [pendingClick, setPendingClick] = useState(null)
  const [sending, setSending] = useState(false)
  const [hoverPos, setHoverPos] = useState(null)
  const [openSpot, setOpenSpot] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const mapWrapRef = useRef(null)

  useEffect(() => {
    db.from('maps').select('*').order('sort_order').then(({ data }) => {
      setMaps(data ?? [])
      setMapsLoading(false)
    })
  }, [])

  const selectedMap = maps.find(m => m.name === selectedName) || null
  const supported = SUPPORTED_MAPS.has(selectedName)

  function loadSpots() {
    if (!supported) { setSpots([]); return }
    db.from('mokoko_finder_spots').select('*').eq('map', selectedName).then(({ data }) => {
      setSpots(data ?? [])
    })
  }

  function loadReportCount() {
    if (!isAdmin || !supported) { setReportCount(0); return }
    db.from('mokoko_finder_reports').select('id', { count: 'exact', head: true }).eq('map', selectedName).then(({ count }) => {
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
  }, [isAdmin, selectedName, supported])

  function handleMapClick(e) {
    if (!mapWrapRef.current || !selectedMap || !supported) return
    const rect = mapWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos(null)
    setPendingClick({ x, y })
  }

  function handleMapMouseMove(e) {
    if (!mapWrapRef.current || !supported) return
    const rect = mapWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos({ x, y, clientX: e.clientX, clientY: e.clientY })
  }

  async function handleReportSubmit(x, y, screenshotUrl, turnstileToken) {
    setSending(true)
    const { error } = await db
      .from('mokoko_finder_reports')
      .insert({ map: selectedName, x, y, screenshot_url: screenshotUrl, turnstileToken })
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

  function handleSpotDeleted(spot) {
    setSpots(prev => prev.filter(s => s.id !== spot.id))
    setOpenSpot(null)
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
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10 w-full">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Mokoko Finder (admin)' }]} />
          <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-100">🍀 Mokoko Finder</h1>
            <button
              onClick={() => setReviewOpen(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold border transition-colors bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200"
            >
              🛡️ Zgłoszenia do przeglądu{reportCount > 0 ? ` (${reportCount})` : ''}
            </button>
          </div>

          {mapsLoading ? <Spinner /> : (
            <div className="flex gap-4 flex-col md:flex-row">
              <aside className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible md:max-h-[70vh] md:overflow-y-auto pb-1 md:pb-0">
                {maps.map(m => {
                  const active = m.name === selectedName
                  const isSupported = SUPPORTED_MAPS.has(m.name)
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedName(m.name)}
                      className={`shrink-0 md:shrink w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border whitespace-nowrap md:whitespace-normal ${
                        active
                          ? 'bg-yellow-400 border-yellow-400 text-gray-950'
                          : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800 text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 min-w-0">
                          {!isSupported && (
                            <span className={active ? 'text-gray-700' : 'text-gray-600'} title="Mokoko Finder jeszcze tu nie działa">⏳</span>
                          )}
                          <span className="font-semibold truncate">{m.name}</span>
                        </span>
                        {m.max_mokoko != null && (
                          <span className={`text-[10px] font-mono font-bold shrink-0 ${active ? 'text-gray-800' : 'text-gray-500'}`}>
                            🍀×{m.max_mokoko}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${active ? 'text-gray-800' : 'text-gray-500'}`}>{m.region}</div>
                    </button>
                  )
                })}
              </aside>

              <div className="flex-1 min-w-0">
                {!selectedMap ? (
                  <p className="text-gray-500 text-sm p-6">Mapa nie znaleziona.</p>
                ) : (
                  <>
                    <h2 className="text-sm font-bold text-gray-100 mb-2">{selectedMap.name}</h2>

                    {!supported && (
                      <p className="text-xs text-gray-500 mb-2">
                        Mokoko Finder nie jest jeszcze podłączony do tej mapy - zakładka na razie tylko pokazuje, jak to będzie wyglądać.
                      </p>
                    )}

                    <div
                      className="relative w-full rounded-xl border border-gray-700 bg-gray-950 overflow-y-auto overflow-x-hidden"
                      style={{ maxHeight: '70vh' }}
                    >
                      <div
                        ref={mapWrapRef}
                        onClick={handleMapClick}
                        onMouseMove={handleMapMouseMove}
                        onMouseLeave={() => setHoverPos(null)}
                        className={`relative ${supported ? 'cursor-crosshair' : 'cursor-default'}`}
                        style={{ width: '100%', aspectRatio: `${selectedMap.width} / ${selectedMap.height}` }}
                      >
                        <img
                          src={selectedMap.image_url}
                          alt={selectedMap.name}
                          draggable="false"
                          className="w-full h-full object-contain select-none pointer-events-none"
                        />
                        {spots.map(spot => (
                          <button
                            key={spot.id}
                            onClick={e => { e.stopPropagation(); setOpenSpot(spot) }}
                            title="Kliknij, aby zobaczyć / usunąć"
                            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform"
                            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                          >
                            <img src="/mokoko.png" alt="" draggable="false" className="w-8 h-8 object-contain drop-shadow select-none" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-yellow-400">
                      {supported ? 'Kliknij na mapę, aby zgłosić mokoko.' : 'Zgłaszanie jest wyłączone dla tej mapy.'}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {hoverPos && selectedMap && !pendingClick && supported && (
        <div
          className="fixed z-20 pointer-events-none rounded-md border border-gray-600 bg-gray-900/90 px-2 py-1 text-[11px] font-mono text-gray-100 shadow-lg whitespace-nowrap"
          style={{ left: hoverPos.clientX + 14, top: hoverPos.clientY + 14 }}
        >
          X: {Math.round((hoverPos.x / 100) * selectedMap.width)} Y: {Math.round((hoverPos.y / 100) * selectedMap.height)}
        </div>
      )}

      {pendingClick && selectedMap && (
        <MokokoFinderReportModal
          map={selectedMap}
          initialX={(pendingClick.x / 100) * selectedMap.width}
          initialY={(pendingClick.y / 100) * selectedMap.height}
          onClose={() => setPendingClick(null)}
          onSubmit={handleReportSubmit}
          sending={sending}
        />
      )}

      {reviewOpen && selectedMap && (
        <MokokoFinderReviewModal
          map={selectedMap}
          onClose={() => { setReviewOpen(false); loadReportCount() }}
          onApproved={handleApproved}
        />
      )}

      {openSpot && (
        <MokokoFinderSpotModal
          spot={openSpot}
          onClose={() => setOpenSpot(null)}
          onDeleted={handleSpotDeleted}
        />
      )}
    </div>
  )
}
