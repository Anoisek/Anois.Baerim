import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Tile from '../components/Tile'
import Spinner from '../components/Spinner'

export default function Systems() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [interactiveMapMaintenance, setInteractiveMapMaintenance] = useState(false)
  const [explorationMaintenance, setExplorationMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    Promise.all([
      db.from('settings').select('value').eq('key', 'system_interactivemap_maintenance').maybeSingle(),
      db.from('settings').select('value').eq('key', 'system_exploration_maintenance').maybeSingle(),
    ]).then(([mapRes, explorationRes]) => {
      setInteractiveMapMaintenance(mapRes.data?.value === 'true')
      setExplorationMaintenance(explorationRes.data?.value === 'true')
      setLoading(false)
    })
  }, [])

  const tiles = [
    { key: 'interactivemap', settingKey: 'system_interactivemap_maintenance', to: '/systems/interactive-map', emoji: '🗺️', label: t('systems.interactiveMap'), maintenance: interactiveMapMaintenance, setMaintenance: setInteractiveMapMaintenance },
    { key: 'exploration', settingKey: 'system_exploration_maintenance', to: '/systems/exploration', emoji: '🧭', label: t('systems.exploration'), maintenance: explorationMaintenance, setMaintenance: setExplorationMaintenance },
  ]

  async function toggleMaintenance(tile) {
    const next = !tile.maintenance
    tile.setMaintenance(next)
    await db.from('settings').upsert({ key: tile.settingKey, value: String(next) })
  }

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('systems.title') }]} />
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{t('systems.title')}</h1>
            {isAdmin && (
              <button
                onClick={() => setEditMode(v => !v)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${editMode ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200'}`}
              >
                {editMode ? t('common.done') : t('common.editPanel')}
              </button>
            )}
          </div>

          {loading ? <Spinner /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {tiles.map(tile => (
                <Tile
                  key={tile.key}
                  to={tile.to}
                  emoji={tile.emoji}
                  label={tile.label}
                  maintenance={tile.maintenance}
                  blocked={tile.maintenance && !isAdmin}
                  onToggleMaintenance={isAdmin && editMode ? () => toggleMaintenance(tile) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
