import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Tile from '../components/Tile'
import Spinner from '../components/Spinner'
import EditSystemTileModal from '../components/EditSystemTileModal'

export default function Systems() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [settingsMap, setSettingsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editingTileKey, setEditingTileKey] = useState(null)

  useEffect(() => {
    db.from('settings').select('*').ilike('key', 'system\\_%').then(({ data }) => {
      const map = {}
      for (const row of data ?? []) map[row.key] = row.value
      setSettingsMap(map)
      setLoading(false)
    })
  }, [])

  const tileDefs = [
    { key: 'interactivemap', to: '/systems/interactive-map', emoji: '🗺️', defaultLabel: t('systems.interactiveMap') },
    { key: 'exploration', to: '/systems/exploration', emoji: '🧭', defaultLabel: t('systems.exploration') },
    { key: 'metincalculator', to: '/systems/metin-calculator', emoji: '🪨', defaultLabel: t('systems.metinCalculator') },
    { key: 'colorsystem', to: '/systems/color-system', emoji: '🎨', defaultLabel: t('systems.colorSystem') },
    { key: 'bonuses', to: '/systems/bonuses', emoji: '🎁', defaultLabel: t('systems.bonuses') },
  ]

  const tiles = tileDefs.map(def => ({
    ...def,
    maintenance: settingsMap[`system_${def.key}_maintenance`] === 'true',
    label: settingsMap[`system_${def.key}_name`] || def.defaultLabel,
    icon: settingsMap[`system_${def.key}_icon`] || '',
  }))

  async function toggleMaintenance(tile) {
    const next = !tile.maintenance
    const key = `system_${tile.key}_maintenance`
    setSettingsMap(prev => ({ ...prev, [key]: String(next) }))
    await db.from('settings').upsert({ key, value: String(next) })
  }

  function handleTileSaved(tileKey, { name, icon }) {
    setSettingsMap(prev => ({ ...prev, [`system_${tileKey}_name`]: name, [`system_${tileKey}_icon`]: icon }))
  }

  const editingTile = tiles.find(t => t.key === editingTileKey) ?? null

  return (
    <div className="text-white">
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
                  image={tile.icon || undefined}
                  emoji={tile.emoji}
                  label={tile.label}
                  maintenance={tile.maintenance}
                  blocked={tile.maintenance && !isAdmin}
                  onEdit={isAdmin ? () => setEditingTileKey(tile.key) : undefined}
                  onToggleMaintenance={isAdmin && editMode ? () => toggleMaintenance(tile) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {editingTile && (
        <EditSystemTileModal
          tileKey={editingTile.key}
          defaultName={editingTile.defaultLabel}
          defaultEmoji={editingTile.emoji}
          currentName={settingsMap[`system_${editingTile.key}_name`] || ''}
          currentIcon={settingsMap[`system_${editingTile.key}_icon`] || ''}
          onClose={() => setEditingTileKey(null)}
          onSaved={result => handleTileSaved(editingTile.key, result)}
        />
      )}
    </div>
  )
}
