import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import AddMetinModal from '../components/AddMetinModal'
import EditMetinModal from '../components/EditMetinModal'
import { slugify } from '../utils/slug'
import { PageHeader, RowList, Row, GridWrap, GridTile, ViewToggle, useViewMode, EmptyState, PillButton } from './ui'

export default function MetinCalculatorH() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [maintenance, setMaintenance] = useState(false)
  const [metins, setMetins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [view, setView] = useViewMode('metins')

  useEffect(() => {
    Promise.all([
      db.from('settings').select('value').eq('key', 'system_metincalculator_maintenance').maybeSingle(),
      db.from('metins').select('*').order('sort_order'),
    ]).then(([maintRes, metinsRes]) => {
      setMaintenance(maintRes.data?.value === 'true')
      setMetins(metinsRes.data ?? [])
      setLoading(false)
    })
  }, [])

  const blocked = maintenance && !isAdmin

  function handleAdded(metin) { setMetins(prev => [...prev, metin].sort((a, b) => a.sort_order - b.sort_order)) }
  function handleUpdated(metin) { setMetins(prev => prev.map(m => m.id === metin.id ? metin : m).sort((a, b) => a.sort_order - b.sort_order)) }
  function handleDeleted(id) { setMetins(prev => prev.filter(m => m.id !== id)) }

  async function persistMetinOrder(newMetins) {
    setMetins(newMetins.map((m, i) => ({ ...m, sort_order: i })))
    await Promise.all(newMetins.map((m, i) => db.from('metins').update({ sort_order: i }).eq('id', m.id)))
  }

  function moveMetin(index, delta) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= metins.length) return
    const reordered = [...metins]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    persistMetinOrder(reordered)
  }

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[
          { label: t('common.home'), to: '/' },
          { label: t('systems.title'), to: '/systems' },
          { label: t('systems.metinCalculator') },
        ]} />
        <PageHeader
          title={t('systems.metinCalculator')}
          actions={<>
            <ViewToggle view={view} onChange={setView} />
            {isAdmin && !blocked && metins.length > 1 && (
              <PillButton active={editMode} onClick={() => setEditMode(v => !v)}>{editMode ? t('common.done') : t('common.editPanel')}</PillButton>
            )}
            {isAdmin && !blocked && (
              <PillButton onClick={() => setShowAdd(true)} className="!bg-yellow-400 !text-gray-950 !border-0">+ Add Metin</PillButton>
            )}
          </>}
        />

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : blocked ? (
          <EmptyState emoji="🚧" text={t('systems.blockedMessage')} />
        ) : metins.length === 0 ? (
          <EmptyState emoji="🪨" text="No metins yet." />
        ) : view === 'grid' ? (
          <GridWrap>
            {metins.map(metin => (
              <GridTile
                key={metin.id}
                to={`/systems/metin-calculator/${slugify(metin.name)}`}
                image={metin.image_url}
                emoji="🪨"
                label={metin.name}
                onEdit={isAdmin ? () => setEditing(metin) : undefined}
              />
            ))}
          </GridWrap>
        ) : (
          <RowList>
            {metins.map((metin, index) => (
              <Row
                key={metin.id}
                to={`/systems/metin-calculator/${slugify(metin.name)}`}
                image={metin.image_url}
                emoji="🪨"
                label={metin.name}
                onEdit={isAdmin ? () => setEditing(metin) : undefined}
                reorder={isAdmin && editMode ? {
                  onUp: () => moveMetin(index, -1),
                  onDown: () => moveMetin(index, 1),
                  disableUp: index === 0,
                  disableDown: index === metins.length - 1,
                } : undefined}
              />
            ))}
          </RowList>
        )}
      </div>

      {showAdd && (
        <AddMetinModal nextSortOrder={Math.max(0, ...metins.map(m => m.sort_order)) + 10} onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
      {editing && (
        <EditMetinModal metin={editing} onClose={() => setEditing(null)} onUpdated={handleUpdated} onDeleted={handleDeleted} />
      )}
    </div>
  )
}
