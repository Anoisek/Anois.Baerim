import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import AddMarkerModal from '../components/AddMarkerModal'
import EditMarkerModal from '../components/EditMarkerModal'
import MarkerPanel from '../components/MarkerPanel'
import HallOfFameModal from '../components/HallOfFameModal'
import AddMapModal from '../components/AddMapModal'
import EditMapModal from '../components/EditMapModal'
import ReorderButtons from '../components/ReorderButtons'
import MapPipButton from '../components/MapPipButton'
import MokokoRevealCountdown from '../components/MokokoRevealCountdown'
import MokokoCompletionModal from '../components/MokokoCompletionModal'
import ConfirmBulkMarkModal from '../components/ConfirmBulkMarkModal'
import { isMarkerCollected } from '../utils/markerCollected'

const COLLECTED_KEY = 'map_collected_markers'

function getNextMokokoNumber(markers) {
  const used = new Set()
  for (const m of markers) {
    const match = /^Mokoko #(\d+)$/.exec(m.title ?? '')
    if (match) used.add(Number(match[1]))
  }
  let n = 1
  while (used.has(n)) n++
  return n
}

function loadCollected() {
  try {
    return JSON.parse(localStorage.getItem(COLLECTED_KEY)) ?? {}
  } catch {
    return {}
  }
}

export default function Maps() {
  const { mapId } = useParams()
  const navigate = useNavigate()
  const { isAdmin, canAddMarkers } = useAuth()
  const { t } = useTranslation()

  const [maps, setMaps] = useState([])
  const [mapsLoading, setMapsLoading] = useState(true)
  const [markers, setMarkers] = useState([])
  const [markersLoading, setMarkersLoading] = useState(true)
  const [allMarkers, setAllMarkers] = useState([])
  const [markerCounts, setMarkerCounts] = useState({})
  const [pendingReveal, setPendingReveal] = useState({})

  const [editMode, setEditMode] = useState(false)
  const [addingAt, setAddingAt] = useState(null)
  const [editingMarker, setEditingMarker] = useState(null)
  const [openMarker, setOpenMarker] = useState(null)
  const [collected, setCollected] = useState(loadCollected)
  const [showCollected, setShowCollected] = useState(true)
  const [showHelpers, setShowHelpers] = useState(false)
  const [editingMap, setEditingMap] = useState(null)
  const [addingMap, setAddingMap] = useState(false)
  const [repositioningMarker, setRepositioningMarker] = useState(null)
  const [confirmBulkMode, setConfirmBulkMode] = useState(null)
  const importInputRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressFiredRef = useRef(false)

  useEffect(() => {
    db.from('maps').select('*').order('sort_order').then(({ data }) => {
      setMaps(data ?? [])
      setMapsLoading(false)
    })
    db.from('map_markers').select('id, map_id, copied_from').then(({ data }) => {
      setAllMarkers(data ?? [])
    })
    db.rpc('map_marker_counts').then(({ data }) => {
      const next = {}
      for (const row of data ?? []) next[row.map_id] = Number(row.total)
      setMarkerCounts(next)
    })
    refreshPendingReveal()
  }, [])

  function refreshPendingReveal() {
    db.rpc('map_pending_reveal').then(({ data }) => {
      const next = {}
      for (const row of data ?? []) next[row.map_id] = row.reveal_at
      setPendingReveal(next)
    })
  }

  async function persistMapOrder(id, newOrder) {
    setMaps(prev => prev.map(m => m.id === id ? { ...m, sort_order: newOrder } : m).sort((a, b) => a.sort_order - b.sort_order))
    await db.from('maps').update({ sort_order: newOrder }).eq('id', id)
  }

  function moveMap(index, delta) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= maps.length) return
    const a = maps[index]
    const b = maps[targetIndex]
    persistMapOrder(a.id, b.sort_order)
    persistMapOrder(b.id, a.sort_order)
  }

  function mapStats(id) {
    const markersOfMap = allMarkers.filter(mk => mk.map_id === id)
    const done = markersOfMap.filter(mk => isMarkerCollected(mk, collected)).length
    return { total: markerCounts[id] ?? markersOfMap.length, done }
  }

  const visibleMaps = maps.filter(m => isAdmin || !m.admin_only)

  const redWoodV2 = maps.find(m => m.name === 'Red Wood v2')
  const eligibleMarkers = allMarkers.filter(mk => mk.map_id !== redWoodV2?.id)
  const eligibleTotal = maps.reduce((sum, m) => m.id === redWoodV2?.id ? sum : sum + (markerCounts[m.id] ?? 0), 0)
  const eligibleDone = eligibleMarkers.filter(mk => isMarkerCollected(mk, collected)).length
  const allMokokoCollected = eligibleTotal > 0 && eligibleDone === eligibleTotal

  useEffect(() => {
    if (mapsLoading || visibleMaps.length === 0) return
    if (!mapId || !visibleMaps.some(m => m.id === mapId)) {
      navigate(`/systems/interactive-map/${visibleMaps[0].id}`, { replace: true })
    }
  }, [mapsLoading, visibleMaps, mapId, navigate])

  const selectedMap = visibleMaps.find(m => m.id === mapId)

  useEffect(() => {
    if (!selectedMap) return
    setMarkersLoading(true)
    setOpenMarker(null)
    setEditingMarker(null)
    setAddingAt(null)
    setRepositioningMarker(null)
    db.from('map_markers').select('*').eq('map_id', selectedMap.id).then(({ data }) => {
      setMarkers(data ?? [])
      setMarkersLoading(false)
    })
  }, [selectedMap?.id, selectedMap?.width, selectedMap?.height])

  useEffect(() => {
    if (!markers.length) return
    setCollected(prev => {
      let changed = false
      const next = { ...prev }
      for (const m of markers) {
        if (!m.copied_from) continue
        if (Object.prototype.hasOwnProperty.call(next, m.id)) continue
        if (next[m.copied_from]) {
          next[m.id] = true
          changed = true
        }
      }
      if (!changed) return prev
      localStorage.setItem(COLLECTED_KEY, JSON.stringify(next))
      return next
    })
  }, [markers])

  useEffect(() => {
    setRepositioningMarker(null)
  }, [editMode])

  useEffect(() => {
    if (!repositioningMarker) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') setRepositioningMarker(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [repositioningMarker])

  function applyBulkMark(value) {
    setCollected(prev => {
      const next = { ...prev }
      for (const m of markers) next[m.id] = value
      localStorage.setItem(COLLECTED_KEY, JSON.stringify(next))
      return next
    })
    setConfirmBulkMode(null)
  }

  function toggleCollected(marker) {
    const current = isMarkerCollected(marker, collected)
    setCollected(prev => {
      const next = { ...prev, [marker.id]: !current }
      localStorage.setItem(COLLECTED_KEY, JSON.stringify(next))
      return next
    })
  }

  function handleExportProgress() {
    const blob = new Blob([JSON.stringify(collected, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baerim-mokoko-progress-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportProgressClick() {
    importInputRef.current?.click()
  }

  async function handleImportProgressFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid file')
      setCollected(prev => {
        const next = { ...prev, ...parsed }
        localStorage.setItem(COLLECTED_KEY, JSON.stringify(next))
        return next
      })
    } catch {
      alert(t('maps.importError'))
    }
  }

  async function moveMarkerTo(marker, x, y) {
    setRepositioningMarker(null)
    const { data, error } = await db.from('map_markers').update({ x, y }).eq('id', marker.id).select().single()
    if (error) { alert('Error: ' + error.message); return }
    setMarkers(prev => prev.map(m => m.id === data.id ? data : m))
  }

  function handleContainerClick(e) {
    if (!selectedMap) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * selectedMap.width)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * selectedMap.height)
    if (repositioningMarker) {
      moveMarkerTo(repositioningMarker, x, y)
      return
    }
    if (!canAddMarkers || !editMode) return
    setAddingAt({ x, y })
  }

  function handleMarkerPointerDown(marker) {
    if (!isAdmin || !editMode) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setRepositioningMarker(marker)
    }, 2000)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimerRef.current)
  }

  function handleMarkerClick(e, marker) {
    e.stopPropagation()
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    if (repositioningMarker) {
      setRepositioningMarker(null)
      return
    }
    if (isAdmin && editMode) {
      setEditingMarker(marker)
    } else {
      toggleCollected(marker)
      setOpenMarker(prev => (prev?.id === marker.id ? null : marker))
    }
  }

  const visibleMarkers = markers.filter(m => showCollected || !isMarkerCollected(m, collected))
  const allCollectedOnMap = markers.length > 0 && markers.every(m => isMarkerCollected(m, collected))

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('maps.title') },
          ]} />
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-gray-100">{t('maps.title')}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportProgress}
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
                title={t('maps.exportProgressTooltip')}
              >
                {t('maps.exportProgress')}
              </button>
              <button
                onClick={handleImportProgressClick}
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
                title={t('maps.importProgressTooltip')}
              >
                {t('maps.importProgress')}
              </button>
              <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportProgressFile} />
              <button
                onClick={() => setShowHelpers(true)}
                className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
              >
                {t('maps.hallOfFame')}
              </button>
            </div>
          </div>

          {mapsLoading ? <Spinner /> : visibleMaps.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🗺️</span>
              <p className="text-sm">{t('maps.noMapsYet')}</p>
            </div>
          ) : (
            <div className="flex gap-4 flex-col md:flex-row">
              <aside className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible md:max-h-[70vh] md:overflow-y-auto pb-1 md:pb-0">
                {visibleMaps.map((m, index) => {
                  const active = m.id === selectedMap?.id
                  const { total, done } = mapStats(m.id)
                  const complete = total > 0 && done === total
                  const statColor = total === 0
                    ? (active ? 'text-gray-700' : 'text-gray-500')
                    : complete
                      ? (active ? 'text-green-700' : 'text-green-400')
                      : (active ? 'text-red-700' : 'text-red-400')
                  const isMaxed = m.max_mokoko != null && total >= m.max_mokoko
                  return (
                    <div key={m.id} className="relative shrink-0 md:shrink group">
                      <button
                        onClick={() => navigate(`/systems/interactive-map/${m.id}`)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border whitespace-nowrap md:whitespace-normal ${
                          active
                            ? 'bg-yellow-400 border-yellow-400 text-gray-950'
                            : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800 text-gray-200'
                        }`}
                      >
                        <div className={`flex items-center justify-between gap-2 ${isAdmin ? 'pr-5 pl-6' : ''}`}>
                          <span className="flex items-center gap-1 min-w-0">
                            {isMaxed && (
                              <span className={active ? 'text-gray-900' : 'text-yellow-400'} title={t('maps.maxReachedTooltip')}>★</span>
                            )}
                            {m.admin_only && (
                              <span className={active ? 'text-gray-900' : 'text-gray-500'} title={t('maps.adminOnlyTooltip')}>🔒</span>
                            )}
                            <span className="font-semibold truncate">{m.name}</span>
                          </span>
                          <span className={`text-[10px] font-mono font-bold shrink-0 ${statColor}`}>{done}/{total}</span>
                        </div>
                        <div className={`text-xs ${active ? 'text-gray-800' : 'text-gray-500'} ${isAdmin ? 'pl-6' : ''}`}>{m.region}</div>
                      </button>
                      {isAdmin && (
                        <ReorderButtons
                          onUp={() => moveMap(index, -1)}
                          onDown={() => moveMap(index, 1)}
                          disableUp={index === 0}
                          disableDown={index === visibleMaps.length - 1}
                        />
                      )}
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); setEditingMap(m) }}
                          title={t('maps.editMapTooltip')}
                          className={`absolute top-1.5 right-1.5 text-xs opacity-60 hover:opacity-100 ${active ? 'text-gray-800' : 'text-gray-300'}`}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  )
                })}
                {isAdmin && (
                  <button
                    onClick={() => setAddingMap(true)}
                    className="shrink-0 md:shrink text-left px-3 py-2 rounded-lg text-sm border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                  >
                    {t('maps.addMap')}
                  </button>
                )}
              </aside>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-lg font-bold text-gray-100">{selectedMap?.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">
                      <strong className="text-gray-200">{markers.filter(m => isMarkerCollected(m, collected)).length}</strong>/{selectedMap ? (markerCounts[selectedMap.id] ?? markers.length) : markers.length} {t('maps.collected')}
                    </span>
                    <button
                      onClick={() => setShowCollected(v => !v)}
                      className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
                    >
                      {showCollected ? t('maps.hideCollected') : t('maps.showCollected')}
                    </button>
                    {markers.length > 0 && (
                      <button
                        onClick={() => setConfirmBulkMode(allCollectedOnMap ? 'deselect' : 'select')}
                        className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
                      >
                        {allCollectedOnMap ? t('maps.deselectAll') : t('maps.selectAll')}
                      </button>
                    )}
                    {selectedMap && !markersLoading && (
                      <MapPipButton
                        map={selectedMap}
                        markers={markers}
                        collected={collected}
                        onToggleCollected={toggleCollected}
                        doneCount={markers.filter(m => isMarkerCollected(m, collected)).length}
                        totalCount={markerCounts[selectedMap.id] ?? markers.length}
                        t={t}
                      />
                    )}
                    {canAddMarkers && (
                      <button
                        onClick={() => setEditMode(v => !v)}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${editMode ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200'}`}
                      >
                        {editMode ? t('maps.done') : t('maps.editPanel')}
                      </button>
                    )}
                  </div>
                </div>

                {markersLoading || !selectedMap ? <Spinner /> : (
                  <>
                    <div className="relative w-full overflow-auto rounded-xl border border-gray-700 bg-gray-950" style={{ maxHeight: '70vh' }}>
                    <div
                      className={`relative ${editMode || repositioningMarker ? 'cursor-crosshair' : ''}`}
                      style={{ aspectRatio: `${selectedMap.width} / ${selectedMap.height}`, width: '100%', minWidth: `${Math.min(selectedMap.width, 900)}px` }}
                      onClick={handleContainerClick}
                    >
                      <img
                        src={selectedMap.image_url}
                        alt={selectedMap.name}
                        draggable="false"
                        className="w-full h-full object-contain select-none pointer-events-none"
                      />
                      {visibleMarkers.map(marker => {
                        const isCollected = isMarkerCollected(marker, collected)
                        const isRepositioning = repositioningMarker?.id === marker.id
                        const isPending = isAdmin && editMode && marker.visible_at && new Date(marker.visible_at) > new Date()
                        return (
                          <div
                            key={marker.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${(marker.x / selectedMap.width) * 100}%`, top: `${(marker.y / selectedMap.height) * 100}%` }}
                          >
                            <button
                              onClick={e => handleMarkerClick(e, marker)}
                              onPointerDown={() => handleMarkerPointerDown(marker)}
                              onPointerUp={cancelLongPress}
                              onPointerLeave={cancelLongPress}
                              onPointerCancel={cancelLongPress}
                              title={marker.title || undefined}
                              className={`relative block hover:scale-125 transition-transform ${isCollected ? 'opacity-40' : ''} ${
                                isRepositioning ? 'animate-pulse ring-4 ring-yellow-400 rounded-full' : ''
                              }`}
                            >
                              {marker.icon?.startsWith('/')
                                ? <img src={marker.icon} alt="" draggable="false" className="w-8 h-8 object-contain drop-shadow select-none" />
                                : <span className="text-2xl leading-none drop-shadow">{marker.icon}</span>}
                              {isPending && (
                                <span
                                  className="absolute -top-1 -right-1 text-xs drop-shadow"
                                  title={t('maps.pendingVisibilityTooltip')}
                                >
                                  ⏳
                                </span>
                              )}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    </div>
                    {repositioningMarker ? (
                      <p className="text-xs text-yellow-400 mt-3">{t('maps.repositionHint')}</p>
                    ) : canAddMarkers && editMode && (
                      <p className="text-xs text-gray-500 mt-3">{t('maps.clickToAddMarker')}</p>
                    )}
                    {pendingReveal[selectedMap.id] && (
                      <MokokoRevealCountdown revealAt={pendingReveal[selectedMap.id]} />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {addingAt && selectedMap && (
        <AddMarkerModal
          mapId={selectedMap.id}
          x={addingAt.x}
          y={addingAt.y}
          nextNumber={getNextMokokoNumber(markers)}
          onClose={() => setAddingAt(null)}
          onAdded={marker => {
            setMarkers(prev => [...prev, marker])
            setAllMarkers(prev => [...prev, { id: marker.id, map_id: marker.map_id }])
            setMarkerCounts(prev => ({ ...prev, [marker.map_id]: (prev[marker.map_id] ?? 0) + 1 }))
            refreshPendingReveal()
          }}
        />
      )}

      {editingMarker && (
        <EditMarkerModal
          marker={editingMarker}
          onClose={() => setEditingMarker(null)}
          onUpdated={marker => {
            setMarkers(prev => prev.map(m => m.id === marker.id ? marker : m))
            refreshPendingReveal()
          }}
          onDeleted={id => {
            setMarkers(prev => prev.filter(m => m.id !== id))
            setAllMarkers(prev => prev.filter(mk => mk.id !== id))
            if (editingMarker) {
              setMarkerCounts(prev => ({ ...prev, [editingMarker.map_id]: Math.max(0, (prev[editingMarker.map_id] ?? 1) - 1) }))
            }
            refreshPendingReveal()
          }}
        />
      )}

      {openMarker && (
        <MarkerPanel marker={openMarker} onClose={() => setOpenMarker(null)} />
      )}

      {showHelpers && (
        <HallOfFameModal onClose={() => setShowHelpers(false)} />
      )}

      <MokokoCompletionModal show={allMokokoCollected} />

      {confirmBulkMode && (
        <ConfirmBulkMarkModal
          mode={confirmBulkMode}
          onCancel={() => setConfirmBulkMode(null)}
          onConfirm={() => applyBulkMark(confirmBulkMode === 'select')}
        />
      )}

      {editingMap && (
        <EditMapModal
          map={editingMap}
          onClose={() => setEditingMap(null)}
          onUpdated={updated => setMaps(prev => prev.map(m => m.id === updated.id ? updated : m))}
        />
      )}

      {addingMap && (
        <AddMapModal
          nextSortOrder={Math.max(0, ...maps.map(m => m.sort_order)) + 10}
          onClose={() => setAddingMap(false)}
          onAdded={map => setMaps(prev => [...prev, map].sort((a, b) => a.sort_order - b.sort_order))}
        />
      )}
    </div>
  )
}
