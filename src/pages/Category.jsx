import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Tile from '../components/Tile'
import AddSubcategoryModal from '../components/AddSubcategoryModal'
import EditSubcategoryModal from '../components/EditSubcategoryModal'
import Spinner from '../components/Spinner'

export default function Category() {
  const { categoryId } = useParams()
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const [category, setCategory] = useState(null)
  const [subcategories, setSubcategories] = useState([])
  const [hasUncategorized, setHasUncategorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    Promise.all([
      db.from('categories').select('*').eq('id', categoryId).single(),
      db.from('subcategories').select('*').eq('category_id', categoryId).order('sort_order'),
      db.from('items').select('id').eq('category_id', categoryId).is('subcategory_id', null),
    ]).then(([catRes, subRes, uncatRes]) => {
      setCategory(catRes.data)
      setSubcategories(subRes.data ?? [])
      setHasUncategorized((uncatRes.data ?? []).length > 0)
      setLoading(false)
    })
  }, [categoryId])

  async function persistSubOrder(id, newOrder) {
    setSubcategories(prev => prev.map(s => s.id === id ? { ...s, sort_order: newOrder } : s).sort((a, b) => a.sort_order - b.sort_order))
    await db.from('subcategories').update({ sort_order: newOrder }).eq('id', id)
  }

  function moveSubcategory(index, delta) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= subcategories.length) return
    const a = subcategories[index]
    const b = subcategories[targetIndex]
    persistSubOrder(a.id, b.sort_order)
    persistSubOrder(b.id, a.sort_order)
  }

  async function toggleMaintenance(sub) {
    const next = !sub.maintenance
    setSubcategories(prev => prev.map(s => s.id === sub.id ? { ...s, maintenance: next } : s))
    await db.from('subcategories').update({ maintenance: next }).eq('id', sub.id)
  }

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: category?.name ?? t('common.chapter') }]} />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {category?.image_url && (
              <img src={category.image_url} alt={category.name} className="w-8 h-8 object-contain" />
            )}
            <h1 className="text-2xl font-bold text-gray-100">{category?.name ?? t('common.chapter')}</h1>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditMode(v => !v)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${editMode ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200'}`}
              >
                {editMode ? t('common.done') : t('common.editPanel')}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                {t('category.addCategory')}
              </button>
            </div>
          )}
        </div>

        {loading ? <Spinner /> : subcategories.length === 0 && !hasUncategorized ? (
          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-sm">{t('category.noCategoriesYet')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {subcategories.map((sub, index) => (
              <Tile
                key={sub.id}
                to={`/chapter/${categoryId}/sub/${sub.id}`}
                image={sub.image_url}
                emoji="📦"
                label={sub.name}
                onEdit={isAdmin ? () => setEditing(sub) : undefined}
                reorder={isAdmin && editMode ? {
                  onUp: () => moveSubcategory(index, -1),
                  onDown: () => moveSubcategory(index, 1),
                  disableUp: index === 0,
                  disableDown: index === subcategories.length - 1,
                } : undefined}
                maintenance={sub.maintenance}
                blocked={sub.maintenance && !isAdmin}
                onToggleMaintenance={isAdmin && editMode ? () => toggleMaintenance(sub) : undefined}
              />
            ))}
            {hasUncategorized && (
              <Tile
                to={`/chapter/${categoryId}/sub/none`}
                emoji="🗂️"
                label={t('category.uncategorized')}
              />
            )}
          </div>
        )}
      </div>

        </div>
      {showModal && (
        <AddSubcategoryModal
          categoryId={categoryId}
          nextSortOrder={Math.max(0, ...subcategories.map(s => s.sort_order)) + 10}
          onClose={() => setShowModal(false)}
          onAdded={sub => setSubcategories(prev => [...prev, sub])}
        />
      )}
      {editing && (
        <EditSubcategoryModal
          subcategory={editing}
          onClose={() => setEditing(null)}
          onUpdated={sub => setSubcategories(prev => prev.map(s => s.id === sub.id ? sub : s))}
          onDeleted={id => setSubcategories(prev => prev.filter(s => s.id !== id))}
        />
      )}
    </div>
  )
}
