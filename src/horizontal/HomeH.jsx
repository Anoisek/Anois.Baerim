import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import PromoBanner from '../components/PromoBanner'
import AddCategoryModal from '../components/AddCategoryModal'
import EditCategoryModal from '../components/EditCategoryModal'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import Spinner from '../components/Spinner'
import { deleteImages } from '../utils/imageStorage'
import { slugify } from '../utils/slug'

function EditTileImageModal({ title, settingKey, currentUrl, onClose, onSaved }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState(currentUrl ?? '')

  async function handleNewImage(url) {
    await deleteImages(imageUrl)
    setImageUrl(url)
  }
  async function handleRemove() {
    await deleteImages(imageUrl)
    setImageUrl('')
  }
  async function handleSave() {
    setSaving(true)
    await db.from('settings').upsert({ key: settingKey, value: imageUrl || null })
    onSaved(imageUrl || null)
    onClose()
    setSaving(false)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">{t('home.image')}</label>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt={title} className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
              <button type="button" onClick={handleRemove} className="text-sm text-red-400 hover:text-red-300">
                {t('home.removeImage')}
              </button>
            </div>
          ) : (
            <ImageUpload onUploaded={handleNewImage} />
          )}
          {imageUrl && (
            <div className="mt-1">
              <p className="text-xs text-gray-500 mb-1">{t('home.replaceImage')}</p>
              <ImageUpload onUploaded={handleNewImage} />
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Modal>
  )
}

// One full-width banded row — the horizontal design's unit of navigation
// everywhere a "tile" would have appeared in the vertical site. No card, no
// border of its own: the strip of rows sits inside one bordered panel and
// separates rows with a hairline + alternating tint instead.
function ChapterRow({ to, image, emoji, label, maintenance, blocked, onEdit, onToggleMaintenance, hidden, onToggleHidden, reorder, dashed, onClick }) {
  const { t } = useTranslation()
  const content = (
    <>
      {reorder && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); reorder.onUp() }} disabled={reorder.disableUp}
            className="w-5 h-5 flex items-center justify-center rounded bg-black/30 border border-white/10 text-gray-400 hover:text-yellow-400 disabled:opacity-20 text-[10px] leading-none transition-colors">▲</button>
          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); reorder.onDown() }} disabled={reorder.disableDown}
            className="w-5 h-5 flex items-center justify-center rounded bg-black/30 border border-white/10 text-gray-400 hover:text-yellow-400 disabled:opacity-20 text-[10px] leading-none transition-colors">▼</button>
        </div>
      )}
      <div className="w-12 h-12 shrink-0 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center">
        {image ? <img src={image} alt={label} loading="lazy" className="w-8 h-8 object-contain" /> : <span className="text-2xl">{emoji}</span>}
      </div>
      <span className={`flex-1 min-w-0 truncate text-[15px] font-semibold ${dashed ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-100'}`}>
        {label}
      </span>
      {maintenance && (
        <span className="shrink-0 text-[11px] font-bold text-yellow-400 bg-black/40 border border-yellow-400/30 px-2 py-1 rounded-full">
          🚧 {t('common.inProgress')}
        </span>
      )}
      {maintenance && hidden && (
        <span className="shrink-0 text-[11px] font-bold text-gray-300 bg-black/40 border border-white/20 px-2 py-1 rounded-full">🙈 Hidden</span>
      )}
      {onToggleMaintenance && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleMaintenance() }}
          className={`shrink-0 text-[11px] px-1.5 py-1 rounded-full border transition-colors ${maintenance ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-black/30 border-white/10 text-gray-400 hover:text-yellow-400'}`}>
          🚧
        </button>
      )}
      {maintenance && onToggleHidden && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleHidden() }}
          title={hidden ? 'Hidden from users while in progress — click to show' : 'Visible to users while in progress — click to hide'}
          className={`shrink-0 text-[11px] px-1.5 py-1 rounded-full border transition-colors ${hidden ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-black/30 border-white/10 text-gray-400 hover:text-yellow-400'}`}>
          {hidden ? '🙈' : '👁'}
        </button>
      )}
      {onEdit && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
          className="shrink-0 text-gray-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all">
          ✏️
        </button>
      )}
      {!blocked && <span className="shrink-0 text-gray-600 group-hover:text-yellow-400 group-hover:translate-x-0.5 transition-all">›</span>}
    </>
  )

  const cls = `group relative flex items-center gap-4 px-5 py-3.5 transition-colors odd:bg-white/[0.02] ${
    dashed ? 'border-l-2 border-dashed border-yellow-900/40' : ''
  } ${blocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-yellow-400/[0.05]'}`

  if (blocked) return <div className={cls}>{content}</div>
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>{content}</button>
  return <Link to={to} className={cls}>{content}</Link>
}

export default function HomeH() {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const [categories, setCategories] = useState([])
  const [materialsImage, setMaterialsImage] = useState(null)
  const [systemsImage, setSystemsImage] = useState(null)
  const [buildCalculatorImage, setBuildCalculatorImage] = useState(null)
  const [materialsOrder, setMaterialsOrder] = useState(0)
  const [systemsOrder, setSystemsOrder] = useState(1)
  const [buildCalculatorOrder, setBuildCalculatorOrder] = useState(2)
  const [materialsMaintenance, setMaterialsMaintenance] = useState(false)
  const [systemsMaintenance, setSystemsMaintenance] = useState(false)
  const [buildCalculatorMaintenance, setBuildCalculatorMaintenance] = useState(false)
  const [hiddenMap, setHiddenMap] = useState({}) // { materials|systems|buildcalculator: bool } - hidden from users while in progress
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingMaterials, setEditingMaterials] = useState(false)
  const [editingSystems, setEditingSystems] = useState(false)
  const [editingBuildCalculator, setEditingBuildCalculator] = useState(false)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    Promise.all([
      db.from('categories').select('*').order('sort_order'),
      db.from('settings').select('value').eq('key', 'materials_image_url').maybeSingle(),
      db.from('settings').select('value').eq('key', 'systems_image_url').maybeSingle(),
      db.from('settings').select('value').eq('key', 'materials_sort_order').maybeSingle(),
      db.from('settings').select('value').eq('key', 'systems_sort_order').maybeSingle(),
      db.from('settings').select('value').eq('key', 'materials_maintenance').maybeSingle(),
      db.from('settings').select('value').eq('key', 'systems_maintenance').maybeSingle(),
      db.from('settings').select('value').eq('key', 'buildcalculator_image_url').maybeSingle(),
      db.from('settings').select('value').eq('key', 'buildcalculator_sort_order').maybeSingle(),
      db.from('settings').select('value').eq('key', 'buildcalculator_maintenance').maybeSingle(),
      db.from('settings').select('key, value').ilike('key', '%\\_maintenance\\_hidden'),
    ]).then(([catRes, materialsRes, systemsRes, materialsOrderRes, systemsOrderRes, materialsMaintRes, systemsMaintRes, buildCalculatorRes, buildCalculatorOrderRes, buildCalculatorMaintRes, hiddenRes]) => {
      setHiddenMap(Object.fromEntries((hiddenRes.data ?? []).map(r => [r.key.replace('_maintenance_hidden', ''), r.value === 'true'])))
      setCategories(catRes.data ?? [])
      setMaterialsImage(materialsRes.data?.value ?? null)
      setSystemsImage(systemsRes.data?.value ?? null)
      setMaterialsOrder(Number(materialsOrderRes.data?.value ?? 0))
      setSystemsOrder(Number(systemsOrderRes.data?.value ?? 1))
      setMaterialsMaintenance(materialsMaintRes.data?.value === 'true')
      setSystemsMaintenance(systemsMaintRes.data?.value === 'true')
      setBuildCalculatorImage(buildCalculatorRes.data?.value ?? null)
      setBuildCalculatorOrder(Number(buildCalculatorOrderRes.data?.value ?? 2))
      setBuildCalculatorMaintenance(buildCalculatorMaintRes.data?.value === 'true')
      setLoading(false)
    })
  }, [])

  const tiles = [
    { kind: 'materials', key: 'materials', sort_order: materialsOrder, maintenance: materialsMaintenance, hidden: hiddenMap.materials ?? false, to: '/materials', image: materialsImage, emoji: '⚗️', label: t('home.materials'), onEdit: () => setEditingMaterials(true) },
    { kind: 'systems', key: 'systems', sort_order: systemsOrder, maintenance: systemsMaintenance, hidden: hiddenMap.systems ?? false, to: '/systems', image: systemsImage, emoji: '⚙️', label: t('home.systems'), onEdit: () => setEditingSystems(true) },
    { kind: 'buildcalculator', key: 'buildcalculator', sort_order: buildCalculatorOrder, maintenance: buildCalculatorMaintenance, hidden: hiddenMap.buildcalculator ?? false, to: '/buildcalculator', image: buildCalculatorImage, emoji: '🛡️', label: t('home.buildCalculator'), onEdit: () => setEditingBuildCalculator(true) },
    ...categories.map(cat => ({ kind: 'category', key: cat.id, sort_order: cat.sort_order, maintenance: cat.maintenance ?? false, hidden: cat.maintenance_hidden ?? false, to: `/chapter/${slugify(cat.name)}`, image: cat.image_url, emoji: '📦', label: cat.name, onEdit: () => setEditing(cat), raw: cat })),
  ].sort((a, b) => a.sort_order - b.sort_order)

  async function toggleMaintenance(tile) {
    const next = !tile.maintenance
    if (tile.kind === 'materials') {
      setMaterialsMaintenance(next)
      await db.from('settings').upsert({ key: 'materials_maintenance', value: String(next) })
    } else if (tile.kind === 'systems') {
      setSystemsMaintenance(next)
      await db.from('settings').upsert({ key: 'systems_maintenance', value: String(next) })
    } else if (tile.kind === 'buildcalculator') {
      setBuildCalculatorMaintenance(next)
      await db.from('settings').upsert({ key: 'buildcalculator_maintenance', value: String(next) })
    } else {
      setCategories(prev => prev.map(c => c.id === tile.key ? { ...c, maintenance: next } : c))
      await db.from('categories').update({ maintenance: next }).eq('id', tile.key)
    }
  }

  async function toggleHidden(tile) {
    const next = !tile.hidden
    if (tile.kind === 'category') {
      setCategories(prev => prev.map(c => c.id === tile.key ? { ...c, maintenance_hidden: next } : c))
      await db.from('categories').update({ maintenance_hidden: next }).eq('id', tile.key)
    } else {
      setHiddenMap(prev => ({ ...prev, [tile.kind]: next }))
      await db.from('settings').upsert({ key: `${tile.kind}_maintenance_hidden`, value: String(next) })
    }
  }

  const shownTiles = isAdmin ? tiles : tiles.filter(tile => !(tile.maintenance && tile.hidden))

  async function persistOrder(tile, newOrder) {
    if (tile.kind === 'materials') {
      setMaterialsOrder(newOrder)
      await db.from('settings').upsert({ key: 'materials_sort_order', value: String(newOrder) })
    } else if (tile.kind === 'systems') {
      setSystemsOrder(newOrder)
      await db.from('settings').upsert({ key: 'systems_sort_order', value: String(newOrder) })
    } else if (tile.kind === 'buildcalculator') {
      setBuildCalculatorOrder(newOrder)
      await db.from('settings').upsert({ key: 'buildcalculator_sort_order', value: String(newOrder) })
    } else {
      setCategories(prev => prev.map(c => c.id === tile.key ? { ...c, sort_order: newOrder } : c))
      await db.from('categories').update({ sort_order: newOrder }).eq('id', tile.key)
    }
  }

  function moveTile(index, delta) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= tiles.length) return
    const a = tiles[index]
    const b = tiles[targetIndex]
    persistOrder(a, b.sort_order)
    persistOrder(b, a.sort_order)
  }

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />

      <div className="border-b border-yellow-900/20 bg-gradient-to-b from-yellow-950/20 to-transparent">
        <div className="max-w-[90rem] mx-auto px-6 py-10 flex flex-col items-center text-center gap-3">
          <img src="/big_logo.png" alt="Baerim" className="h-20 w-auto drop-shadow-lg" />
        </div>
      </div>

      <div className="max-w-[90rem] mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-100 tracking-tight">{t('home.chapters')}</h1>
          {isAdmin && (
            <button
              onClick={() => setEditMode(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${editMode ? 'bg-yellow-400 text-gray-950' : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300'}`}
            >
              {editMode ? t('common.done') : t('common.editPanel')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden bg-black/20">
            {shownTiles.map((tile, index) => (
              <ChapterRow
                key={tile.key}
                to={tile.to}
                image={tile.image}
                emoji={tile.emoji}
                label={tile.label}
                onEdit={isAdmin ? tile.onEdit : undefined}
                reorder={isAdmin && editMode ? {
                  onUp: () => moveTile(index, -1),
                  onDown: () => moveTile(index, 1),
                  disableUp: index === 0,
                  disableDown: index === tiles.length - 1,
                } : undefined}
                maintenance={tile.maintenance}
                blocked={tile.maintenance && !isAdmin}
                onToggleMaintenance={isAdmin && editMode ? () => toggleMaintenance(tile) : undefined}
                hidden={tile.hidden}
                onToggleHidden={isAdmin && editMode ? () => toggleHidden(tile) : undefined}
              />
            ))}
            {isAdmin && (
              <ChapterRow dashed emoji="+" label={t('tile.newChapter')} onClick={() => setShowAdd(true)} />
            )}
          </div>
        )}

        <PromoBanner />
      </div>

      {showAdd && (
        <AddCategoryModal
          nextSortOrder={Math.max(0, ...tiles.map(t => t.sort_order)) + 10}
          onClose={() => setShowAdd(false)}
          onAdded={cat => setCategories(prev => [...prev, cat])}
        />
      )}
      {editing && (
        <EditCategoryModal
          category={editing}
          onClose={() => setEditing(null)}
          onUpdated={cat => setCategories(prev => prev.map(c => c.id === cat.id ? cat : c))}
        />
      )}
      {editingMaterials && (
        <EditTileImageModal title={t('home.editMaterialsTile')} settingKey="materials_image_url" currentUrl={materialsImage} onClose={() => setEditingMaterials(false)} onSaved={setMaterialsImage} />
      )}
      {editingSystems && (
        <EditTileImageModal title={t('home.editSystemsTile')} settingKey="systems_image_url" currentUrl={systemsImage} onClose={() => setEditingSystems(false)} onSaved={setSystemsImage} />
      )}
      {editingBuildCalculator && (
        <EditTileImageModal title={t('home.editBuildCalculatorTile')} settingKey="buildcalculator_image_url" currentUrl={buildCalculatorImage} onClose={() => setEditingBuildCalculator(false)} onSaved={setBuildCalculatorImage} />
      )}
    </div>
  )
}
