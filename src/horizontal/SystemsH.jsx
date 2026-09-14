import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import EditSystemTileModal from '../components/EditSystemTileModal'
import { PageHeader, RowList, Row, PillButton } from './ui'

export default function SystemsH() {
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
    { key: 'orefinder', to: '/systems/ore-finder', emoji: '⛏️', defaultLabel: t('systems.oreFinder') },
    { key: 'exploration', to: '/systems/exploration', emoji: '🧭', defaultLabel: t('systems.exploration') },
    { key: 'metincalculator', to: '/systems/metin-calculator', emoji: '🪨', defaultLabel: t('systems.metinCalculator') },
    { key: 'colorsystem', to: '/systems/color-system', emoji: '🎨', defaultLabel: t('systems.colorSystem') },
    { key: 'bonuses', to: '/systems/bonuses', emoji: '🎁', defaultLabel: t('systems.bonuses') },
    { key: 'alchemy', to: '/systems/alchemy', emoji: '⚗️', defaultLabel: t('systems.alchemy') },
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
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('systems.title') }]} />
        <PageHeader
          title={t('systems.title')}
          actions={isAdmin && (
            <PillButton active={editMode} onClick={() => setEditMode(v => !v)}>
              {editMode ? t('common.done') : t('common.editPanel')}
            </PillButton>
          )}
        />

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <RowList>
            {tiles.map(tile => (
              <Row
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
          </RowList>
        )}
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
