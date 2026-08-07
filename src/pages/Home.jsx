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

function EditMaterialsTileModal({ currentUrl, onClose, onSaved }) {
  const [uploading, setUploading] = useState(false)
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
    await supabase.from('settings').upsert({ key: 'materials_image_url', value: imageUrl || null })
    onSaved(imageUrl || null)
    onClose()
    setSaving(false)
  }

  return (
    <Modal title="Edit Materials tile" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Image</label>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt="Materials" className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
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
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingMaterials, setEditingMaterials] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('settings').select('value').eq('key', 'materials_image_url').maybeSingle(),
    ]).then(([catRes, settingRes]) => {
      setCategories(catRes.data ?? [])
      setMaterialsImage(settingRes.data?.value ?? null)
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-6">
          <img src="/big_logo.png" alt="Baerim" className="h-32 w-auto drop-shadow-lg" />
        </div>

        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-6">Chapters</h1>

          {loading ? <Spinner /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <Tile
                to="/materials"
                image={materialsImage}
                emoji="⚗️"
                label="Materials"
                onEdit={isAdmin ? () => setEditingMaterials(true) : undefined}
              />

              {categories.map(cat => (
                <Tile
                  key={cat.id}
                  to={`/chapter/${cat.id}`}
                  image={cat.image_url}
                  emoji="📦"
                  label={cat.name}
                  onEdit={isAdmin ? () => setEditing(cat) : undefined}
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
        <EditMaterialsTileModal
          currentUrl={materialsImage}
          onClose={() => setEditingMaterials(false)}
          onSaved={setMaterialsImage}
        />
      )}
    </div>
  )
}
