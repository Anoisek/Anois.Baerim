import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import MokokoFinderReportModal from '../components/MokokoFinderReportModal'
import MokokoFinderReviewModal from '../components/MokokoFinderReviewModal'
import MokokoFinderSpotModal from '../components/MokokoFinderSpotModal'
import { db } from '../dbClient'
import { pctToGame, fitGameCoords } from '../utils/mokokoFinderCoords'

// Mokoko Finder's own map list - deliberately separate from the interactive
// map's `maps` table (the finder must never touch that data). Names must match
// MOKOKO_FINDER_MAPS in worker/src/db.js, which validates reports against them.
// width/height = the image's aspect ratio (and the interactive map's size);
// the in-game X/Y at the image's edges come from MAP_GAME_COORDS
// (utils/mokokoFinderCoords), so the X/Y shown to users match the game -
// or, once the admin has placed calibration points on a map (calibration
// mode, mokoko_finder_calibration), from a fit through those points.
// Positions are stored as image percentages.
// A map with image_url null is listed but disabled until its image is added.
const FINDER_MAPS = [
  // In-game X/Y calibration: MAP_GAME_COORDS in utils/mokokoFinderCoords.
  { id: 'thunder-mountains', name: 'Thunder Mountains', image_url: '/mokoko-finder/thunder-mountains.png', width: 2048, height: 2048 },
  { id: 'enchanted-forest', name: 'Enchanted Forest', image_url: '/mokoko-finder/enchanted-forest.png', width: 1254, height: 1254 },
]
// Same shape as OreFinder's poll: paused on a hidden tab so this doesn't add
// to the worker's shared daily request budget.
const POLL_MS = 20000

// /mokoko-finder (unlisted - reachable by direct link only, the navbar
// shortcut in MokokoFinderLink stays admin-only; noindex in PageMeta): works like
// Dog Tracker's click-to-report, but instead of appearing live it goes into
// an admin review queue with a screenshot as proof (like Ore Finder's manual
// add) - only after approval does it show up on the map with the mokoko icon
// from the interactive map. The admin can merge several reports of the same
// sighting into one spot (see MokokoFinderReviewModal).
export default function MokokoFinder() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [selectedName, setSelectedName] = useState(FINDER_MAPS[0].name)
  const [spots, setSpots] = useState([])
  const [pendingClick, setPendingClick] = useState(null)
  const [sending, setSending] = useState(false)
  const [hoverPos, setHoverPos] = useState(null)
  const [openSpot, setOpenSpot] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reportCount, setReportCount] = useState(0)
  const [calPoints, setCalPoints] = useState([])
  const [calibrating, setCalibrating] = useState(false)
  const [calPending, setCalPending] = useState(null)
  const [calSaving, setCalSaving] = useState(false)
  const mapWrapRef = useRef(null)

  const baseMap = FINDER_MAPS.find(m => m.name === selectedName) || null
  const fittedGame = baseMap ? fitGameCoords(baseMap, calPoints) : null
  const selectedMap = baseMap && fittedGame ? { ...baseMap, game: fittedGame } : baseMap
  const supported = !!selectedMap?.image_url

  // Not polled - only the admin changes these, and their own edits update state directly.
  useEffect(() => {
    setCalPoints([])
    setCalPending(null)
    if (!supported) return
    db.from('mokoko_finder_calibration').select('*').eq('map', selectedName).then(({ data }) => {
      setCalPoints(data ?? [])
    })
  }, [selectedName, supported])

  async function saveCalPoint() {
    const gx = Number(calPending.xInput)
    const gy = Number(calPending.yInput)
    if (calPending.xInput === '' || calPending.yInput === '' || !Number.isFinite(gx) || !Number.isFinite(gy)) return
    setCalSaving(true)
    const { data, error } = await db
      .from('mokoko_finder_calibration')
      .insert({ map: selectedName, x: calPending.x, y: calPending.y, game_x: gx, game_y: gy })
      .select()
      .single()
    setCalSaving(false)
    if (error) {
      alert(`Could not save the calibration point: ${error.message}`)
      return
    }
    setCalPoints(prev => [...prev, data])
    setCalPending(null)
  }

  async function deleteCalPoint(point) {
    if (!window.confirm(`Delete calibration point (${point.game_x}, ${point.game_y})?`)) return
    const { error } = await db.from('mokoko_finder_calibration').delete().eq('id', point.id)
    if (error) {
      alert(`Could not delete the calibration point: ${error.message}`)
      return
    }
    setCalPoints(prev => prev.filter(p => p.id !== point.id))
  }

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
    if (calibrating) {
      const g = pctToGame(selectedMap, x, y)
      setCalPending({ x, y, xInput: String(Math.round(g.x)), yInput: String(Math.round(g.y)) })
      return
    }
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
      alert(t('mokokoFinder.sendError', { message: error.message }))
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

  return (
    <div className="text-white min-h-screen flex flex-col">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10 w-full">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: isAdmin ? `${t('mokokoFinder.title')} (admin)` : t('mokokoFinder.title') }]} />
          <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-100">🍀 {t('mokokoFinder.title')}</h1>
            {isAdmin && (
            <div className="flex gap-2 flex-wrap">
            {supported && (
              <button
                onClick={() => { setCalibrating(v => !v); setCalPending(null) }}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  calibrating ? 'bg-red-500 hover:bg-red-400 border-red-500 text-white' : 'bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200'
                }`}
              >
                📐 {calibrating ? 'Finish calibration' : `Calibrate (${calPoints.length})`}
              </button>
            )}
            <button
              onClick={() => setReviewOpen(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold border transition-colors bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200"
            >
              🛡️ {t('mokokoFinder.reviewButton')}{reportCount > 0 ? ` (${reportCount})` : ''}
            </button>
            </div>
            )}
          </div>

          <div className="flex gap-4 flex-col md:flex-row">
              <aside className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible md:max-h-[70vh] md:overflow-y-auto pb-1 md:pb-0">
                {FINDER_MAPS.map(m => {
                  const active = m.name === selectedName
                  const isSupported = !!m.image_url
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
                            <span className={active ? 'text-gray-700' : 'text-gray-600'} title={t('mokokoFinder.notSupportedTooltip')}>⏳</span>
                          )}
                          <span className="font-semibold truncate">{m.name}</span>
                        </span>
                      </div>
                    </button>
                  )
                })}
              </aside>

              <div className="flex-1 min-w-0">
                {!selectedMap ? (
                  <p className="text-gray-500 text-sm p-6">{t('mokokoFinder.mapNotFound')}</p>
                ) : (
                  <>
                    <h2 className="text-sm font-bold text-gray-100 mb-2">{selectedMap.name}</h2>

                    {!supported && (
                      <p className="text-xs text-gray-500 mb-2">
                        {t('mokokoFinder.notSupportedNote')}
                      </p>
                    )}

                    {!supported ? (
                      <div className="w-full aspect-square max-h-[70vh] rounded-xl border border-dashed border-gray-700 bg-gray-950 flex items-center justify-center text-5xl">⏳</div>
                    ) : (
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
                            title={t('mokokoFinder.spotTooltip')}
                            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform"
                            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                          >
                            <img src="/mokoko.png" alt="" draggable="false" className="w-8 h-8 object-contain drop-shadow select-none" />
                          </button>
                        ))}
                        {calibrating && calPoints.map(p => (
                          <button
                            key={p.id}
                            onClick={e => { e.stopPropagation(); deleteCalPoint(p) }}
                            title="Click to delete this calibration point"
                            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 p-1"
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                          >
                            <span className="block w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
                          </button>
                        ))}
                        {calibrating && calPoints.map(p => (
                          <span
                            key={`label-${p.id}`}
                            className="absolute z-20 pointer-events-none translate-x-2 -translate-y-1/2 rounded bg-black/80 px-1 text-[10px] font-mono text-red-300 whitespace-nowrap"
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                          >
                            {p.game_x}, {p.game_y}
                          </span>
                        ))}
                        {calibrating && calPending && (
                          <span
                            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-yellow-400 border-2 border-white shadow animate-pulse"
                            style={{ left: `${calPending.x}%`, top: `${calPending.y}%` }}
                          />
                        )}
                      </div>
                    </div>
                    )}

                    {calibrating ? (
                      <div className="mt-3 rounded-xl border border-red-500/50 bg-red-950/30 p-3 text-xs text-gray-200 flex flex-col gap-2">
                        <p className="text-red-300">
                          Calibration: click a spot on the map whose in-game X/Y you know and type them in. 2+ points far apart
                          (ideally opposite corners) give accurate coordinates; 1 point only shifts them. Click a red dot to delete it.
                        </p>
                        {calPending && (
                          <div className="flex items-end gap-2 flex-wrap">
                            {['xInput', 'yInput'].map(k => (
                              <label key={k} className="flex flex-col gap-1 text-gray-400">
                                {k === 'xInput' ? 'In-game X' : 'In-game Y'}
                                <input
                                  type="number"
                                  value={calPending[k]}
                                  onChange={e => setCalPending(prev => ({ ...prev, [k]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') saveCalPoint() }}
                                  className="w-24 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-400"
                                />
                              </label>
                            ))}
                            <button
                              onClick={saveCalPoint}
                              disabled={calSaving}
                              className="px-3 py-1.5 rounded-lg font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-gray-950"
                            >
                              Save point
                            </button>
                            <button
                              onClick={() => setCalPending(null)}
                              className="px-3 py-1.5 rounded-lg font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {calPoints.length > 0 && (
                          <ul className="font-mono text-[11px] text-gray-400">
                            {calPoints.map(p => {
                              const g = pctToGame(selectedMap, p.x, p.y)
                              const err = Math.round(Math.hypot(g.x - p.game_x, g.y - p.game_y))
                              return (
                                <li key={p.id}>
                                  ({p.game_x}, {p.game_y}) → map shows ({Math.round(g.x)}, {Math.round(g.y)}){err > 0 ? `, off by ${err}` : ''}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                    <p className="mt-3 text-xs text-yellow-400">
                      {supported ? t('mokokoFinder.clickToMark') : t('mokokoFinder.addDisabled')}
                    </p>
                    )}
                  </>
                )}
              </div>
            </div>
        </div>
      </div>

      {hoverPos && selectedMap && !pendingClick && supported && (
        <div
          className="fixed z-20 pointer-events-none rounded-md border border-gray-600 bg-gray-900/90 px-2 py-1 text-[11px] font-mono text-gray-100 shadow-lg whitespace-nowrap"
          style={{ left: hoverPos.clientX + 14, top: hoverPos.clientY + 14 }}
        >
          X: {Math.round(pctToGame(selectedMap, hoverPos.x, hoverPos.y).x)} Y: {Math.round(pctToGame(selectedMap, hoverPos.x, hoverPos.y).y)}
        </div>
      )}

      {pendingClick && selectedMap && (
        <MokokoFinderReportModal
          map={selectedMap}
          initialX={pctToGame(selectedMap, pendingClick.x, pendingClick.y).x}
          initialY={pctToGame(selectedMap, pendingClick.x, pendingClick.y).y}
          onClose={() => setPendingClick(null)}
          onSubmit={handleReportSubmit}
          sending={sending}
        />
      )}

      {isAdmin && reviewOpen && selectedMap && (
        <MokokoFinderReviewModal
          map={selectedMap}
          onClose={() => { setReviewOpen(false); loadReportCount() }}
          onApproved={handleApproved}
        />
      )}

      {openSpot && (
        <MokokoFinderSpotModal
          spot={openSpot}
          isAdmin={isAdmin}
          onClose={() => setOpenSpot(null)}
          onDeleted={handleSpotDeleted}
        />
      )}
    </div>
  )
}
