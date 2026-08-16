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

  useEffect(() => {
    Promise.all([
      db.from('settings').select('value').eq('key', 'system_metincalculator_maintenance').maybeSingle(),
      db.from('metins').select('*').order('name'),
    ]).then(([maintRes, metinsRes]) => {
      setMaintenance(maintRes.data?.value === 'true')
      setMetins(metinsRes.data ?? [])
      setLoading(false)
    })
  }, [])

  const blocked = maintenance && !isAdmin

  function handleAdded(metin) {
    setMetins(prev => [...prev, metin].sort((a, b) => a.name.localeCompare(b.name)))
  }
  function handleUpdated(metin) {
    setMetins(prev => prev.map(m => m.id === metin.id ? metin : m).sort((a, b) => a.name.localeCompare(b.name)))
  }
  function handleDeleted(id) {
    setMetins(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="min-h-screen text-white">
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
              <button
                onClick={() => setShowAdd(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                + Add Metin
              </button>
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
              {metins.map(metin => (
                <Tile
                  key={metin.id}
                  image={metin.image_url}
                  emoji="🪨"
                  label={metin.name}
                  onClick={() => setEditing(metin)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddMetinModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />
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
