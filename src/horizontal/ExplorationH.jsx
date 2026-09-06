import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import EditExplorationLevelModal from '../components/EditExplorationLevelModal'
import { PageHeader, EmptyState, PillButton } from './ui'

const LONG_PRESS_MS = 2000

export default function ExplorationH() {
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
      db.from('settings').select('value').eq('key', 'exploration_map_url').maybeSingle(),
      db.from('settings').select('value').eq('key', 'system_exploration_maintenance').maybeSingle(),
      db.from('exploration_levels').select('*').order('level'),
    ]).then(([mapRes, maintRes, levelsRes]) => {
      setMapUrl(mapRes.data?.value ?? null)
      setMaintenance(maintRes.data?.value === 'true')
      setLevels(levelsRes.data ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { setRepositioningLevel(null) }, [editMode])

  useEffect(() => {
    if (!repositioningLevel) return
    function handleKeyDown(e) { if (e.key === 'Escape') setRepositioningLevel(null) }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [repositioningLevel])

  const blocked = maintenance && !isAdmin

  async function moveLevelTo(lvl, xPercent, yPercent) {
    setRepositioningLevel(null)
    const { data, error } = await db.from('exploration_levels').update({ x_percent: xPercent, y_percent: yPercent }).eq('level', lvl.level).select().single()
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
  function cancelLongPress() { clearTimeout(longPressTimerRef.current) }

  function handleHotspotClick(e, lvl) {
    e.preventDefault()
    e.stopPropagation()
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return }
    if (repositioningLevel) { setRepositioningLevel(null); return }
    setEditingLevel(lvl)
  }

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('systems.title'), to: '/systems' }, { label: t('systems.exploration') }]} />
        <PageHeader
          title={t('systems.exploration')}
          actions={<>
            {maintenance && isAdmin && <span className="text-[11px] font-bold text-yellow-400 bg-black/40 border border-yellow-400/30 px-2 py-1 rounded-full">🚧 {t('common.inProgress')}</span>}
            {isAdmin && !blocked && levels.length > 0 && (
              <PillButton active={editMode} onClick={() => setEditMode(v => !v)}>{editMode ? t('common.done') : t('common.editPanel')}</PillButton>
            )}
          </>}
        />

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : blocked ? (
          <EmptyState emoji="🚧" text={t('systems.blockedMessage')} />
        ) : mapUrl ? (
          <>
            <div className={`relative select-none rounded-xl overflow-hidden border border-white/10 max-w-4xl mx-auto ${repositioningLevel ? 'cursor-crosshair' : ''}`} onClick={handleMapClick}>
              <img src={mapUrl} alt={t('systems.exploration')} draggable="false" className="w-full h-auto select-none pointer-events-none" />
              {levels.map(lvl => {
                const style = { left: `${lvl.x_percent}%`, top: `${lvl.y_percent}%` }
                const isRepositioning = repositioningLevel?.level === lvl.level
                const hotspotCls = `absolute -translate-x-1/2 -translate-y-1/2 w-10 h-14 sm:w-12 sm:h-16 rounded-full transition-colors ${
                  isRepositioning ? 'animate-pulse ring-4 ring-yellow-400 bg-yellow-400/30' : ''
                }`
                return editMode ? (
                  <button key={lvl.level} type="button" onClick={e => handleHotspotClick(e, lvl)} onPointerDown={() => handleHotspotPointerDown(lvl)} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
                    title={lvl.title || t('systems.levelTitlePlaceholder', { level: lvl.level })}
                    className={`${hotspotCls} bg-yellow-400/20 border-2 border-yellow-400 hover:bg-yellow-400/40`} style={style} />
                ) : (
                  <Link key={lvl.level} to={`/systems/exploration/${lvl.level}`} title={lvl.title || t('systems.levelTitlePlaceholder', { level: lvl.level })}
                    className={`${hotspotCls} ${isAdmin ? 'hover:bg-yellow-400/25 hover:ring-2 hover:ring-yellow-400/70' : ''}`} style={style} />
                )
              })}
            </div>
            {editMode && <p className="text-xs text-gray-500 mt-3 text-center">{repositioningLevel ? t('systems.repositionHint') : t('systems.editLevelHint')}</p>}
          </>
        ) : (
          <EmptyState emoji="🗺️" text={t('systems.noMapYet')} />
        )}
      </div>

      {editingLevel && (
        <EditExplorationLevelModal level={editingLevel} onClose={() => setEditingLevel(null)} onSaved={updated => setLevels(prev => prev.map(l => l.level === updated.level ? updated : l))} />
      )}
    </div>
  )
}
