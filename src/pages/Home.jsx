import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import PromoBanner from '../components/PromoBanner'
import AddCategoryModal from '../components/AddCategoryModal'
import EditCategoryModal from '../components/EditCategoryModal'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import Spinner from '../components/Spinner'
import Tile from '../components/Tile'
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

export default function Home() {
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
    ]).then(([catRes, materialsRes, systemsRes, materialsOrderRes, systemsOrderRes, materialsMaintRes, systemsMaintRes, buildCalculatorRes, buildCalculatorOrderRes, buildCalculatorMaintRes]) => {
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
    { kind: 'materials', key: 'materials', sort_order: materialsOrder, maintenance: materialsMaintenance, to: '/materials', image: materialsImage, emoji: '⚗️', label: t('home.materials'), onEdit: () => setEditingMaterials(true) },
    { kind: 'systems', key: 'systems', sort_order: systemsOrder, maintenance: systemsMaintenance, to: '/systems', image: systemsImage, emoji: '⚙️', label: t('home.systems'), onEdit: () => setEditingSystems(true) },
    { kind: 'buildcalculator', key: 'buildcalculator', sort_order: buildCalculatorOrder, maintenance: buildCalculatorMaintenance, to: '/buildcalculator', image: buildCalculatorImage, emoji: '🛡️', label: t('home.buildCalculator'), onEdit: () => setEditingBuildCalculator(true) },
    ...categories.map(cat => ({ kind: 'category', key: cat.id, sort_order: cat.sort_order, maintenance: cat.maintenance ?? false, to: `/chapter/${slugify(cat.name)}`, image: cat.image_url, emoji: '📦', label: cat.name, onEdit: () => setEditing(cat), raw: cat })),
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
    <div className="text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <img src="/big_logo.png" alt="Baerim" className="h-32 w-auto drop-shadow-lg" />
        </div>

        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{t('home.chapters')}</h1>
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
              {tiles.map((tile, index) => (
                <Tile
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
                />
              ))}

              {isAdmin && (
                <Tile dashed emoji="+" label={t('tile.newChapter')} onClick={() => setShowAdd(true)} />
              )}
            </div>
          )}
        </div>

        <div className="mt-6">
          <PromoBanner />
        </div>
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
        <EditTileImageModal
          title={t('home.editMaterialsTile')}
          settingKey="materials_image_url"
          currentUrl={materialsImage}
          onClose={() => setEditingMaterials(false)}
          onSaved={setMaterialsImage}
        />
      )}

      {editingSystems && (
        <EditTileImageModal
          title={t('home.editSystemsTile')}
          settingKey="systems_image_url"
          currentUrl={systemsImage}
          onClose={() => setEditingSystems(false)}
          onSaved={setSystemsImage}
        />
      )}

      {editingBuildCalculator && (
        <EditTileImageModal
          title={t('home.editBuildCalculatorTile')}
          settingKey="buildcalculator_image_url"
          currentUrl={buildCalculatorImage}
          onClose={() => setEditingBuildCalculator(false)}
          onSaved={setBuildCalculatorImage}
        />
      )}
    </div>
  )
}
