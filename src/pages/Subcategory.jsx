import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import AddItemModal from '../components/AddItemModal'
import EditItemModal from '../components/EditItemModal'
import ItemImage from '../components/ItemImage'
import ReorderButtons from '../components/ReorderButtons'
import Spinner from '../components/Spinner'
import { itemImages } from '../utils/itemImages'
import { formatItemName } from '../utils/itemName'

export default function Subcategory() {
  const { categoryId, subcategoryId } = useParams()
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const isUncategorized = subcategoryId === 'none'
  const [category, setCategory] = useState(null)
  const [subcategory, setSubcategory] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [usedInItemIds, setUsedInItemIds] = useState(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    let itemsQuery = db.from('items').select('*').eq('category_id', categoryId).order('sort_order')
    itemsQuery = isUncategorized ? itemsQuery.is('subcategory_id', null) : itemsQuery.eq('subcategory_id', subcategoryId)

    Promise.all([
      db.from('categories').select('id, name').eq('id', categoryId).single(),
      isUncategorized
        ? Promise.resolve({ data: null })
        : db.from('subcategories').select('*').eq('id', subcategoryId).single(),
      itemsQuery,
      db.from('item_items').select('component_item_id'),
    ]).then(([catRes, subRes, itemsRes, itemItemsRes]) => {
      setCategory(catRes.data)
      setSubcategory(subRes.data)
      setItems(itemsRes.data ?? [])
      setUsedInItemIds(new Set((itemItemsRes.data ?? []).map(r => r.component_item_id)))
      setLoading(false)
    })
  }, [categoryId, subcategoryId, isUncategorized])

  async function persistItemOrder(id, newOrder) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, sort_order: newOrder } : i).sort((a, b) => a.sort_order - b.sort_order))
    await db.from('items').update({ sort_order: newOrder }).eq('id', id)
  }

  function moveItem(index, delta) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= items.length) return
    const a = items[index]
    const b = items[targetIndex]
    persistItemOrder(a.id, b.sort_order)
    persistItemOrder(b.id, a.sort_order)
  }

  async function toggleMaintenance(item) {
    const next = !item.maintenance
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, maintenance: next } : i))
    await db.from('items').update({ maintenance: next }).eq('id', item.id)
  }

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <Breadcrumbs items={[
          { label: t('common.home'), to: '/' },
          { label: category?.name ?? t('common.chapter'), to: `/chapter/${categoryId}` },
          { label: isUncategorized ? t('category.uncategorized') : (subcategory?.name ?? t('common.category')) },
        ]} />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {subcategory?.image_url && (
              <img src={subcategory.image_url} alt={subcategory.name} className="w-8 h-8 object-contain" />
            )}
            <h1 className="text-2xl font-bold text-gray-100">{isUncategorized ? t('category.uncategorized') : (subcategory?.name ?? t('common.category'))}</h1>
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
                {t('subcategory.addItem')}
              </button>
            </div>
          )}
        </div>

        {loading ? <Spinner /> : items.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-sm">{t('subcategory.noItemsYet')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((item, index) => {
              const blocked = item.maintenance && !isAdmin
              const Wrapper = blocked ? 'div' : Link
              const wrapperProps = blocked ? {} : { to: `/chapter/${categoryId}/item/${item.id}` }
              return (
              <Wrapper
                key={item.id}
                {...wrapperProps}
                className={`group relative bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col items-center gap-4 transition-all duration-200 ${
                  blocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-400/50 hover:bg-gray-800 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5'
                }`}
              >
                <div className="w-16 h-16 flex items-center justify-center">
                  {itemImages(item).length > 0
                    ? <ItemImage images={itemImages(item)} alt={item.name} className="w-full h-full object-contain drop-shadow" />
                    : <span className="text-4xl">⚔️</span>}
                </div>
                <span className="text-sm font-semibold text-gray-100 text-center leading-tight group-hover:text-yellow-400 transition-colors">
                  {formatItemName(item)}
                </span>
                {item.maintenance && (
                  <span className="absolute inset-0 flex items-center justify-center bg-gray-950/70 rounded-2xl pointer-events-none">
                    <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
                      🚧 {t('common.inProgress')}
                    </span>
                  </span>
                )}
                {isAdmin && editMode && (
                  <ReorderButtons
                    onUp={() => moveItem(index, -1)}
                    onDown={() => moveItem(index, 1)}
                    disableUp={index === 0}
                    disableDown={index === items.length - 1}
                  />
                )}
                {!editMode && usedInItemIds.has(item.id) && (
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/items/${item.id}/usage`) }}
                    className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-800/90 border border-gray-600 text-gray-300 hover:text-yellow-400 hover:border-yellow-400/50 transition-colors text-xs z-10"
                    title={t('common.seeUsage')}
                  >
                    🔗
                  </button>
                )}
                {isAdmin && editMode && (
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); toggleMaintenance(item) }}
                    className={`absolute bottom-2 right-2 text-xs px-1.5 py-1 rounded-full border transition-colors z-10 ${
                      item.maintenance ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-gray-800/90 border-gray-600 text-gray-300 hover:text-yellow-400'
                    }`}
                    title={item.maintenance ? t('common.endMaintenance') : t('common.markInProgress')}
                  >
                    🚧
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(item) }}
                    className="absolute top-2 right-2 text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-base z-10"
                    title={t('common.edit')}
                  >
                    ✏️
                  </button>
                )}
              </Wrapper>
              )
            })}
          </div>
        )}
      </div>

        </div>
      {showModal && (
        <AddItemModal
          categoryId={categoryId}
          subcategoryId={isUncategorized ? null : subcategoryId}
          nextSortOrder={Math.max(0, ...items.map(i => i.sort_order)) + 10}
          onClose={() => setShowModal(false)}
          onAdded={item => setItems(prev => [...prev, item].sort((a, b) => a.sort_order - b.sort_order))}
        />
      )}
      {editing && (
        <EditItemModal
          item={editing}
          categoryId={categoryId}
          onClose={() => setEditing(null)}
          onUpdated={item => setItems(prev => {
            const next = item.subcategory_id === editing.subcategory_id
              ? prev.map(i => i.id === item.id ? item : i)
              : prev.filter(i => i.id !== item.id)
            return next.sort((a, b) => a.sort_order - b.sort_order)
          })}
          onDeleted={id => setItems(prev => prev.filter(i => i.id !== id))}
        />
      )}
    </div>
  )
}
