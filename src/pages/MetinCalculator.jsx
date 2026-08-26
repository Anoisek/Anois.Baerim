import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import Tile from '../components/Tile'
import AddMetinModal from '../components/AddMetinModal'
import EditMetinModal from '../components/EditMetinModal'

export default function MetinCalculator() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [maintenance, setMaintenance] = useState(false)
  const [metins, setMetins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editMode, setEditMode] = useState(false)

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

  function handleAdded(metin) {
    setMetins(prev => [...prev, metin].sort((a, b) => a.sort_order - b.sort_order))
  }
  function handleUpdated(metin) {
    setMetins(prev => prev.map(m => m.id === metin.id ? metin : m).sort((a, b) => a.sort_order - b.sort_order))
  }
  function handleDeleted(id) {
    setMetins(prev => prev.filter(m => m.id !== id))
  }

  // Reassigns sequential sort_order to the whole list on every move (instead of
  // swapping just the two moved rows' values) — pre-existing metins all share
  // sort_order 0, and swapping two equal values would otherwise be a no-op.
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
    <div className="text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.metinCalculator') },
          ]} />
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-100">{t('systems.metinCalculator')}</h1>
              {maintenance && isAdmin && (
                <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
                  🚧 {t('common.inProgress')}
                </span>
              )}
            </div>
            {isAdmin && !blocked && (
              <div className="flex items-center gap-2">
                {metins.length > 1 && (
                  <button
                    onClick={() => setEditMode(v => !v)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${editMode ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200'}`}
                  >
                    {editMode ? t('common.done') : t('common.editPanel')}
                  </button>
                )}
                <button
                  onClick={() => setShowAdd(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  + Add Metin
                </button>
              </div>
            )}
          </div>

          {loading ? <Spinner /> : blocked ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🚧</span>
              <p className="text-sm">{t('systems.blockedMessage')}</p>
            </div>
          ) : metins.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🪨</span>
              <p className="text-sm">No metins yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {metins.map((metin, index) => (
                <Tile
                  key={metin.id}
                  to={`/systems/metin-calculator/${metin.id}`}
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
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddMetinModal
          nextSortOrder={Math.max(0, ...metins.map(m => m.sort_order)) + 10}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
      {editing && (
        <EditMetinModal
          metin={editing}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
