import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import EditExplorationLevelModal from '../components/EditExplorationLevelModal'

export default function Exploration() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [mapUrl, setMapUrl] = useState(null)
  const [maintenance, setMaintenance] = useState(false)
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editingLevel, setEditingLevel] = useState(null)

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

  const blocked = maintenance && !isAdmin

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
            <div className="relative select-none">
              <img src={mapUrl} alt={t('systems.exploration')} className="w-full h-auto rounded-xl border border-gray-700" />
              {levels.map(lvl => {
                const style = { left: `${lvl.x_percent}%`, top: `${lvl.y_percent}%` }
                const hotspotCls = 'absolute -translate-x-1/2 -translate-y-1/2 w-10 h-14 sm:w-12 sm:h-16 rounded-full transition-colors'
                return editMode ? (
                  <button
                    key={lvl.level}
                    type="button"
                    onClick={() => setEditingLevel(lvl)}
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
