import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import EditExplorationLevelModal from '../components/EditExplorationLevelModal'

const LONG_PRESS_MS = 2000

export default function Exploration() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [mapUrl, setMapUrl] = useState(null)
  const [maintenance, setMaintenance] = useState(false)
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editingLevel, setEditingLevel] = useState(null)
  const [repositioningLevel, setRepositioningLevel] = useState(null)
  const longPressTimerRef = useRef(null)
  const longPressFiredRef = useRef(false)

  useEffect(() => {
    Promise.all([
      supabase.from('settings').select('value').eq('key', 'exploration_map_url').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'system_exploration_maintenance').maybeSingle(),
      supabase.from('exploration_levels').select('*').order('level'),
    ]).then(([mapRes, maintRes, levelsRes]) => {
      setMapUrl(mapRes.data?.value ?? null)
      setMaintenance(maintRes.data?.value === 'true')
      setLevels(levelsRes.data ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    setRepositioningLevel(null)
  }, [editMode])

  useEffect(() => {
    if (!repositioningLevel) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') setRepositioningLevel(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [repositioningLevel])

  const blocked = maintenance && !isAdmin

  async function moveLevelTo(lvl, xPercent, yPercent) {
    setRepositioningLevel(null)
    const { data, error } = await supabase
      .from('exploration_levels')
      .update({ x_percent: xPercent, y_percent: yPercent })
      .eq('level', lvl.level)
      .select()
      .single()
    if (error) { alert('Error: ' + error.message); return }
    setLevels(prev => prev.map(l => l.level === data.level ? data : l))
  }

  function handleMapClick(e) {
    if (!repositioningLevel) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    moveLevelTo(repositioningLevel, Math.round(x * 10) / 10, Math.round(y * 10) / 10)
  }

  function handleHotspotPointerDown(lvl) {
    if (!editMode) return
    clearTimeout(longPressTimerRef.current)
    longPressFiredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setRepositioningLevel(lvl)
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimerRef.current)
  }

  function handleHotspotClick(e, lvl) {
    e.preventDefault()
    e.stopPropagation()
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    if (repositioningLevel) {
      setRepositioningLevel(null)
      return
    }
    setEditingLevel(lvl)
  }

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.exploration') },
          ]} />
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-100">{t('systems.exploration')}</h1>
              {maintenance && isAdmin && (
                <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
                  🚧 {t('common.inProgress')}
                </span>
              )}
            </div>
            {isAdmin && !blocked && levels.length > 0 && (
              <button
                onClick={() => setEditMode(v => !v)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${editMode ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200'}`}
              >
                {editMode ? t('common.done') : t('common.editPanel')}
              </button>
            )}
          </div>

          {loading ? <Spinner /> : blocked ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🚧</span>
              <p className="text-sm">{t('systems.blockedMessage')}</p>
            </div>
          ) : mapUrl ? (
            <>
              <div
                className={`relative select-none rounded-xl overflow-hidden border border-gray-700 ${repositioningLevel ? 'cursor-crosshair' : ''}`}
                onClick={handleMapClick}
              >
                <img src={mapUrl} alt={t('systems.exploration')} draggable="false" className="w-full h-auto select-none pointer-events-none" />
                {levels.map(lvl => {
                  const style = { left: `${lvl.x_percent}%`, top: `${lvl.y_percent}%` }
                  const isRepositioning = repositioningLevel?.level === lvl.level
                  const hotspotCls = `absolute -translate-x-1/2 -translate-y-1/2 w-10 h-14 sm:w-12 sm:h-16 rounded-full transition-colors ${
                    isRepositioning ? 'animate-pulse ring-4 ring-yellow-400 bg-yellow-400/30' : ''
                  }`
                  return editMode ? (
                    <button
                      key={lvl.level}
                      type="button"
                      onClick={e => handleHotspotClick(e, lvl)}
                      onPointerDown={() => handleHotspotPointerDown(lvl)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      title={lvl.title || t('systems.levelTitlePlaceholder', { level: lvl.level })}
                      className={`${hotspotCls} bg-yellow-400/20 border-2 border-yellow-400 hover:bg-yellow-400/40`}
                      style={style}
                    />
                  ) : (
                    <Link
                      key={lvl.level}
                      to={`/systems/exploration/${lvl.level}`}
                      title={lvl.title || t('systems.levelTitlePlaceholder', { level: lvl.level })}
                      className={`${hotspotCls} hover:bg-yellow-400/25 hover:ring-2 hover:ring-yellow-400/70`}
                      style={style}
                    />
                  )
                })}
              </div>
              {editMode && (
                <p className="text-xs text-gray-500 mt-3">
                  {repositioningLevel ? t('systems.repositionHint') : t('systems.editLevelHint')}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🗺️</span>
              <p className="text-sm">{t('systems.noMapYet')}</p>
            </div>
          )}
        </div>
      </div>

      {editingLevel && (
        <EditExplorationLevelModal
          level={editingLevel}
          onClose={() => setEditingLevel(null)}
          onSaved={updated => setLevels(prev => prev.map(l => l.level === updated.level ? updated : l))}
        />
      )}
    </div>
  )
}
