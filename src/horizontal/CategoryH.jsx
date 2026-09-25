import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import AddSubcategoryModal from '../components/AddSubcategoryModal'
import EditSubcategoryModal from '../components/EditSubcategoryModal'
import Spinner from '../components/Spinner'
import { slugify, findBySlugOrId } from '../utils/slug'
import { directItemFor } from '../utils/directSubItem'
import { PageHeader, RowList, Row, GridWrap, GridTile, ViewToggle, useViewMode, EmptyState, PillButton } from './ui'

export default function CategoryH() {
  const { categoryId } = useParams()
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const [category, setCategory] = useState(null)
  const [subcategories, setSubcategories] = useState([])
  const [hasUncategorized, setHasUncategorized] = useState(false)
  const [categoryItems, setCategoryItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [view, setView] = useViewMode('category')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    db.from('categories').select('*').then(({ data }) => {
      if (cancelled) return
      const resolved = findBySlugOrId(data ?? [], categoryId)
      if (!resolved) { setCategory(null); setLoading(false); return }
      setCategory(resolved)
      Promise.all([
        db.from('subcategories').select('*').eq('category_id', resolved.id).order('sort_order'),
        db.from('items').select('id, name, subcategory_id').eq('category_id', resolved.id),
      ]).then(([subRes, itemsRes]) => {
        if (cancelled) return
        setSubcategories(subRes.data ?? [])
        setCategoryItems(itemsRes.data ?? [])
        setHasUncategorized((itemsRes.data ?? []).some(i => i.subcategory_id == null))
        setLoading(false)
      })
    })
    return () => { cancelled = true }
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

  async function toggleHidden(sub) {
    const next = !sub.maintenance_hidden
    setSubcategories(prev => prev.map(s => s.id === sub.id ? { ...s, maintenance_hidden: next } : s))
    await db.from('subcategories').update({ maintenance_hidden: next }).eq('id', sub.id)
  }

  function subLink(sub) {
    const direct = directItemFor(sub, categoryItems)
    return direct ? `/chapter/${categoryId}/item/${slugify(direct.name)}` : `/chapter/${categoryId}/sub/${slugify(sub.name)}`
  }

  const shownSubcategories = isAdmin ? subcategories : subcategories.filter(s => !(s.maintenance && s.maintenance_hidden))

  async function toggleMaintenance(sub) {
    const next = !sub.maintenance
    setSubcategories(prev => prev.map(s => s.id === sub.id ? { ...s, maintenance: next } : s))
    await db.from('subcategories').update({ maintenance: next }).eq('id', sub.id)
  }

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: category?.name ?? t('common.chapter') }]} />
        <PageHeader
          title={category?.name ?? t('common.chapter')}
          actions={<>
            <ViewToggle view={view} onChange={setView} />
            {isAdmin && (
              <>
                <PillButton active={editMode} onClick={() => setEditMode(v => !v)}>{editMode ? t('common.done') : t('common.editPanel')}</PillButton>
                <PillButton onClick={() => setShowModal(true)} className="!bg-yellow-400 !text-gray-950 !border-0">{t('category.addCategory')}</PillButton>
              </>
            )}
          </>}
        />

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : subcategories.length === 0 && !hasUncategorized ? (
          <EmptyState emoji="📭" text={t('category.noCategoriesYet')} />
        ) : view === 'grid' ? (
          <GridWrap>
            {shownSubcategories.map(sub => (
              <GridTile
                key={sub.id}
                to={subLink(sub)}
                image={sub.image_url}
                emoji="📦"
                label={sub.name}
                onEdit={isAdmin ? () => setEditing(sub) : undefined}
                maintenance={sub.maintenance}
                blocked={sub.maintenance && !isAdmin}
                onToggleMaintenance={isAdmin && editMode ? () => toggleMaintenance(sub) : undefined}
                hidden={sub.maintenance_hidden}
                onToggleHidden={isAdmin && editMode ? () => toggleHidden(sub) : undefined}
              />
            ))}
            {hasUncategorized && <GridTile to={`/chapter/${categoryId}/sub/none`} emoji="🗂️" label={t('category.uncategorized')} />}
          </GridWrap>
        ) : (
          <RowList>
            {shownSubcategories.map((sub, index) => (
              <Row
                key={sub.id}
                to={subLink(sub)}
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
                hidden={sub.maintenance_hidden}
                onToggleHidden={isAdmin && editMode ? () => toggleHidden(sub) : undefined}
              />
            ))}
            {hasUncategorized && <Row to={`/chapter/${categoryId}/sub/none`} emoji="🗂️" label={t('category.uncategorized')} />}
          </RowList>
        )}
      </div>

      {showModal && (
        <AddSubcategoryModal
          categoryId={category.id}
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
