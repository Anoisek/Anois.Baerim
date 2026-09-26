import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import AddItemModal from '../components/AddItemModal'
import EditItemModal from '../components/EditItemModal'
import Spinner from '../components/Spinner'
import { itemImages } from '../utils/itemImages'
import { formatItemName } from '../utils/itemName'
import { slugify, findBySlugOrId } from '../utils/slug'
import { isMountSubcategory } from '../utils/mountSystem'
import { isPetSubcategory } from '../utils/petSystem'
import { directItemFor } from '../utils/directSubItem'
import MountSystem from '../components/MountSystem'
import PetSystem from '../components/PetSystem'
import { PageHeader, RowList, Row, GridWrap, GridTile, ViewToggle, useViewMode, EmptyState, PillButton } from './ui'

export default function SubcategoryH() {
  const { categoryId, subcategoryId } = useParams()
  const { isAdmin, session } = useAuth()
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
  const [view, setView] = useViewMode('subcategory')
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      db.from('categories').select('*'),
      db.from('item_items').select('component_item_id'),
    ]).then(([catsRes, itemItemsRes]) => {
      if (cancelled) return
      const cat = findBySlugOrId(catsRes.data ?? [], categoryId)
      setUsedInItemIds(new Set((itemItemsRes.data ?? []).map(r => r.component_item_id)))
      if (!cat) { setCategory(null); setLoading(false); return }
      setCategory(cat)

      const subPromise = isUncategorized
        ? Promise.resolve(null)
        : db.from('subcategories').select('*').eq('category_id', cat.id).then(({ data }) => findBySlugOrId(data ?? [], subcategoryId))

      subPromise.then(sub => {
        if (cancelled) return
        setSubcategory(sub)
        if (!isUncategorized && !sub) { setItems([]); setLoading(false); return }

        let itemsQuery = db.from('items').select('*').eq('category_id', cat.id).order('sort_order')
        itemsQuery = isUncategorized ? itemsQuery.is('subcategory_id', null) : itemsQuery.eq('subcategory_id', sub.id)
        itemsQuery.then(({ data }) => {
          if (cancelled) return
          const direct = session !== undefined && !isAdmin && directItemFor(sub, data)
          if (direct) { navigate(`/chapter/${categoryId}/item/${slugify(direct.name)}`, { replace: true }); return }
          setItems(data ?? [])
          setLoading(false)
        })
      })
    })
    return () => { cancelled = true }
  }, [categoryId, subcategoryId, isUncategorized, session, isAdmin, navigate])

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

  async function toggleHidden(item) {
    const next = !item.maintenance_hidden
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, maintenance_hidden: next } : i))
    await db.from('items').update({ maintenance_hidden: next }).eq('id', item.id)
  }

  const isPet = isPetSubcategory(subcategory)
  const isMount = isMountSubcategory(subcategory) || isPet // both are calculators, not item lists
  const shownItems = isAdmin ? items : items.filter(i => !(i.maintenance && i.maintenance_hidden))

  async function toggleMaintenance(item) {
    const next = !item.maintenance
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, maintenance: next } : i))
    await db.from('items').update({ maintenance: next }).eq('id', item.id)
  }

  const title = isUncategorized ? t('category.uncategorized') : (subcategory?.name ?? t('common.category'))

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[
          { label: t('common.home'), to: '/' },
          { label: category?.name ?? t('common.chapter'), to: `/chapter/${categoryId}` },
          { label: title },
        ]} />
        <PageHeader
          title={title}
          actions={isMount ? null : <>
            <ViewToggle view={view} onChange={setView} />
            {isAdmin && (
              <>
                <PillButton active={editMode} onClick={() => setEditMode(v => !v)}>{editMode ? t('common.done') : t('common.editPanel')}</PillButton>
                <PillButton onClick={() => setShowModal(true)} className="!bg-yellow-400 !text-gray-950 !border-0">{t('subcategory.addItem')}</PillButton>
              </>
            )}
          </>}
        />

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : isMount ? (
          isPet ? <PetSystem horizontal /> : <MountSystem categoryId={category.id} horizontal />
        ) : items.length === 0 ? (
          <EmptyState emoji="📭" text={t('subcategory.noItemsYet')} />
        ) : view === 'grid' ? (
          <GridWrap>
            {shownItems.map(item => {
              const blocked = item.maintenance && !isAdmin
              return (
                <GridTile
                  key={item.id}
                  to={blocked ? undefined : `/chapter/${categoryId}/item/${slugify(item.name)}`}
                  image={itemImages(item)[0]}
                  emoji="⚔️"
                  label={formatItemName(item)}
                  onEdit={isAdmin ? () => setEditing(item) : undefined}
                  maintenance={item.maintenance}
                  blocked={blocked}
                  onToggleMaintenance={isAdmin && editMode ? () => toggleMaintenance(item) : undefined}
                  hidden={item.maintenance_hidden}
                  onToggleHidden={isAdmin && editMode ? () => toggleHidden(item) : undefined}
                />
              )
            })}
          </GridWrap>
        ) : (
          <RowList>
            {shownItems.map((item, index) => {
              const blocked = item.maintenance && !isAdmin
              return (
                <Row
                  key={item.id}
                  to={blocked ? undefined : `/chapter/${categoryId}/item/${slugify(item.name)}`}
                  image={itemImages(item)[0]}
                  emoji="⚔️"
                  label={formatItemName(item)}
                  onEdit={isAdmin ? () => setEditing(item) : undefined}
                  reorder={isAdmin && editMode ? {
                    onUp: () => moveItem(index, -1),
                    onDown: () => moveItem(index, 1),
                    disableUp: index === 0,
                    disableDown: index === items.length - 1,
                  } : undefined}
                  maintenance={item.maintenance}
                  blocked={blocked}
                  onToggleMaintenance={isAdmin && editMode ? () => toggleMaintenance(item) : undefined}
                  hidden={item.maintenance_hidden}
                  onToggleHidden={isAdmin && editMode ? () => toggleHidden(item) : undefined}
                >
                  {!editMode && usedInItemIds.has(item.id) && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/items/${item.id}/usage`) }}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-black/30 border border-white/10 text-gray-300 hover:text-yellow-400 hover:border-yellow-400/50 transition-colors text-xs"
                      title={t('common.seeUsage')}
                    >
                      🔗
                    </button>
                  )}
                </Row>
              )
            })}
          </RowList>
        )}
      </div>

      {showModal && (
        <AddItemModal
          categoryId={category.id}
          subcategoryId={isUncategorized ? null : subcategory?.id}
          nextSortOrder={Math.max(0, ...items.map(i => i.sort_order)) + 10}
          onClose={() => setShowModal(false)}
          onAdded={item => setItems(prev => [...prev, item].sort((a, b) => a.sort_order - b.sort_order))}
        />
      )}
      {editing && (
        <EditItemModal
          item={editing}
          categoryId={category.id}
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
