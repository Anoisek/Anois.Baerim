import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import AddCategoryModal from '../components/AddCategoryModal'
import EditCategoryModal from '../components/EditCategoryModal'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import Spinner from '../components/Spinner'
import Tile from '../components/Tile'

function extractStoragePath(url) {
  if (!url) return null
  const marker = '/object/public/images/'
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

function EditTileImageModal({ title, settingKey, currentUrl, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState(currentUrl ?? '')

  async function handleNewImage(url) {
    const path = extractStoragePath(imageUrl)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl(url)
  }

  async function handleRemove() {
    const path = extractStoragePath(imageUrl)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl('')
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('settings').upsert({ key: settingKey, value: imageUrl || null })
    onSaved(imageUrl || null)
    onClose()
    setSaving(false)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Image</label>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt={title} className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
              <button type="button" onClick={handleRemove} className="text-sm text-red-400 hover:text-red-300">
                Remove image
              </button>
            </div>
          ) : (
            <ImageUpload onUploaded={handleNewImage} />
          )}
          {imageUrl && (
            <div className="mt-1">
              <p className="text-xs text-gray-500 mb-1">Replace with new image:</p>
              <ImageUpload onUploaded={handleNewImage} />
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </Modal>
  )
}

export default function Home() {
  const { isAdmin } = useAuth()
  const [categories, setCategories] = useState([])
  const [materialsImage, setMaterialsImage] = useState(null)
  const [systemsImage, setSystemsImage] = useState(null)
  const [materialsOrder, setMaterialsOrder] = useState(0)
  const [systemsOrder, setSystemsOrder] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingMaterials, setEditingMaterials] = useState(false)
  const [editingSystems, setEditingSystems] = useState(false)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('settings').select('value').eq('key', 'materials_image_url').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'systems_image_url').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'materials_sort_order').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'systems_sort_order').maybeSingle(),
    ]).then(([catRes, materialsRes, systemsRes, materialsOrderRes, systemsOrderRes]) => {
      setCategories(catRes.data ?? [])
      setMaterialsImage(materialsRes.data?.value ?? null)
      setSystemsImage(systemsRes.data?.value ?? null)
      setMaterialsOrder(Number(materialsOrderRes.data?.value ?? 0))
      setSystemsOrder(Number(systemsOrderRes.data?.value ?? 1))
      setLoading(false)
    })
  }, [])

  const tiles = [
    { kind: 'materials', key: 'materials', sort_order: materialsOrder, to: '/materials', image: materialsImage, emoji: '⚗️', label: 'Materials', onEdit: () => setEditingMaterials(true) },
    { kind: 'systems', key: 'systems', sort_order: systemsOrder, to: '/systems', image: systemsImage, emoji: '⚙️', label: 'Systems', onEdit: () => setEditingSystems(true) },
    ...categories.map(cat => ({ kind: 'category', key: cat.id, sort_order: cat.sort_order, to: `/chapter/${cat.id}`, image: cat.image_url, emoji: '📦', label: cat.name, onEdit: () => setEditing(cat), raw: cat })),
  ].sort((a, b) => a.sort_order - b.sort_order)

  async function persistOrder(tile, newOrder) {
    if (tile.kind === 'materials') {
      setMaterialsOrder(newOrder)
      await supabase.from('settings').upsert({ key: 'materials_sort_order', value: String(newOrder) })
    } else if (tile.kind === 'systems') {
      setSystemsOrder(newOrder)
      await supabase.from('settings').upsert({ key: 'systems_sort_order', value: String(newOrder) })
    } else {
      setCategories(prev => prev.map(c => c.id === tile.key ? { ...c, sort_order: newOrder } : c))
      await supabase.from('categories').update({ sort_order: newOrder }).eq('id', tile.key)
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
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <img src="/big_logo.png" alt="Baerim" className="h-32 w-auto drop-shadow-lg" />
        </div>

        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-100">Chapters</h1>
            {isAdmin && (
              <button
                onClick={() => setEditMode(v => !v)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${editMode ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200'}`}
              >
                {editMode ? 'Done' : 'Edit panel'}
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
                />
              ))}

              {isAdmin && (
                <Tile dashed emoji="+" label="New chapter" onClick={() => setShowAdd(true)} />
              )}
            </div>
          )}
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
          title="Edit Materials tile"
          settingKey="materials_image_url"
          currentUrl={materialsImage}
          onClose={() => setEditingMaterials(false)}
          onSaved={setMaterialsImage}
        />
      )}

      {editingSystems && (
        <EditTileImageModal
          title="Edit Systems tile"
          settingKey="systems_image_url"
          currentUrl={systemsImage}
          onClose={() => setEditingSystems(false)}
          onSaved={setSystemsImage}
        />
      )}
    </div>
  )
}
