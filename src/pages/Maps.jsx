import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
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

const COLLECTED_KEY = 'map_collected_markers'

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

  const [editMode, setEditMode] = useState(false)
  const [addingAt, setAddingAt] = useState(null)
  const [editingMarker, setEditingMarker] = useState(null)
  const [openMarker, setOpenMarker] = useState(null)
  const [collected, setCollected] = useState(loadCollected)
  const [showCollected, setShowCollected] = useState(true)
  const [showHelpers, setShowHelpers] = useState(false)
  const [editingMap, setEditingMap] = useState(null)
  const [addingMap, setAddingMap] = useState(false)

  useEffect(() => {
    supabase.from('maps').select('*').order('sort_order').then(({ data }) => {
      setMaps(data ?? [])
      setMapsLoading(false)
    })
    supabase.from('map_markers').select('id, map_id').then(({ data }) => {
      setAllMarkers(data ?? [])
    })
  }, [])

  async function persistMapOrder(id, newOrder) {
    setMaps(prev => prev.map(m => m.id === id ? { ...m, sort_order: newOrder } : m).sort((a, b) => a.sort_order - b.sort_order))
    await supabase.from('maps').update({ sort_order: newOrder }).eq('id', id)
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
    const done = markersOfMap.filter(mk => collected[mk.id]).length
    return { total: markersOfMap.length, done }
  }

  useEffect(() => {
    if (mapsLoading || maps.length === 0) return
    if (!mapId || !maps.some(m => m.id === mapId)) {
      navigate(`/systems/interactive-map/${maps[0].id}`, { replace: true })
    }
  }, [mapsLoading, maps, mapId, navigate])

  const selectedMap = maps.find(m => m.id === mapId)

  useEffect(() => {
    if (!selectedMap) return
    setMarkersLoading(true)
    setOpenMarker(null)
    setEditingMarker(null)
    setAddingAt(null)
    supabase.from('map_markers').select('*').eq('map_id', selectedMap.id).then(({ data }) => {
      setMarkers(data ?? [])
      setMarkersLoading(false)
    })
  }, [selectedMap?.id])

  function toggleCollected(markerId) {
    setCollected(prev => {
      const next = { ...prev }
      if (next[markerId]) delete next[markerId]
      else next[markerId] = true
      localStorage.setItem(COLLECTED_KEY, JSON.stringify(next))
      return next
    })
  }

  function handleContainerClick(e) {
    if (!canAddMarkers || !editMode || !selectedMap) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * selectedMap.width)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * selectedMap.height)
    setAddingAt({ x, y })
  }

  function handleMarkerClick(e, marker) {
    e.stopPropagation()
    if (isAdmin && editMode) {
      setEditingMarker(marker)
    } else {
      toggleCollected(marker.id)
      setOpenMarker(prev => (prev?.id === marker.id ? null : marker))
    }
  }

  const visibleMarkers = markers.filter(m => showCollected || !collected[m.id])

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
            <button
              onClick={() => setShowHelpers(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
            >
              {t('maps.hallOfFame')}
            </button>
          </div>

          {mapsLoading ? <Spinner /> : maps.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🗺️</span>
              <p className="text-sm">{t('maps.noMapsYet')}</p>
            </div>
          ) : (
            <div className="flex gap-4 flex-col md:flex-row">
              <aside className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible md:max-h-[70vh] md:overflow-y-auto pb-1 md:pb-0">
                {maps.map((m, index) => {
                  const active = m.id === selectedMap?.id
                  const { total, done } = mapStats(m.id)
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
                          <span className="font-semibold truncate">{m.name}</span>
                          <span className={`text-[10px] font-mono shrink-0 ${active ? 'text-gray-700' : 'text-gray-500'}`}>{done}/{total}</span>
                        </div>
                        <div className={`text-xs ${active ? 'text-gray-800' : 'text-gray-500'} ${isAdmin ? 'pl-6' : ''}`}>{m.region}</div>
                      </button>
                      {isAdmin && (
                        <ReorderButtons
                          onUp={() => moveMap(index, -1)}
                          onDown={() => moveMap(index, 1)}
                          disableUp={index === 0}
                          disableDown={index === maps.length - 1}
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
                      <strong className="text-gray-200">{markers.filter(m => collected[m.id]).length}</strong>/{markers.length} {t('maps.collected')}
                    </span>
                    <button
                      onClick={() => setShowCollected(v => !v)}
                      className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
                    >
                      {showCollected ? t('maps.hideCollected') : t('maps.showCollected')}
                    </button>
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
                    <div
                      className={`relative w-full rounded-xl overflow-hidden border border-gray-700 bg-gray-950 ${editMode ? 'cursor-crosshair' : ''}`}
                      style={{ aspectRatio: `${selectedMap.width} / ${selectedMap.height}` }}
                      onClick={handleContainerClick}
                    >
                      <img
                        src={selectedMap.image_url}
                        alt={selectedMap.name}
                        draggable="false"
                        className="w-full h-full object-contain select-none pointer-events-none"
                      />
                      {visibleMarkers.map(marker => {
                        const isCollected = !!collected[marker.id]
                        return (
                          <div
                            key={marker.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${(marker.x / selectedMap.width) * 100}%`, top: `${(marker.y / selectedMap.height) * 100}%` }}
                          >
                            <button
                              onClick={e => handleMarkerClick(e, marker)}
                              title={marker.title || undefined}
                              className={`block hover:scale-125 transition-transform ${isCollected ? 'opacity-40' : ''}`}
                            >
                              {marker.icon?.startsWith('/')
                                ? <img src={marker.icon} alt="" draggable="false" className="w-8 h-8 object-contain drop-shadow select-none" />
                                : <span className="text-2xl leading-none drop-shadow">{marker.icon}</span>}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {canAddMarkers && editMode && (
                      <p className="text-xs text-gray-500 mt-3">{t('maps.clickToAddMarker')}</p>
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
          nextNumber={markers.length + 1}
          onClose={() => setAddingAt(null)}
          onAdded={marker => {
            setMarkers(prev => [...prev, marker])
            setAllMarkers(prev => [...prev, { id: marker.id, map_id: marker.map_id }])
          }}
        />
      )}

      {editingMarker && (
        <EditMarkerModal
          marker={editingMarker}
          onClose={() => setEditingMarker(null)}
          onUpdated={marker => setMarkers(prev => prev.map(m => m.id === marker.id ? marker : m))}
          onDeleted={id => {
            setMarkers(prev => prev.filter(m => m.id !== id))
            setAllMarkers(prev => prev.filter(mk => mk.id !== id))
          }}
        />
      )}

      {openMarker && (
        <MarkerPanel marker={openMarker} onClose={() => setOpenMarker(null)} />
      )}

      {showHelpers && (
        <HallOfFameModal onClose={() => setShowHelpers(false)} />
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
