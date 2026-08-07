import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

function extractStoragePath(url) {
  if (!url) return null
  const marker = '/object/public/images/'
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

export default function EditSubcategoryModal({ subcategory, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(subcategory.name)
  const [imageUrl, setImageUrl] = useState(subcategory.image_url ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await supabase
      .from('subcategories')
      .update({ name: name.trim(), image_url: imageUrl || null })
      .eq('id', subcategory.id)
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
    } else {
      onUpdated(data)
      onClose()
    }
    setSaving(false)
  }

  async function handleRemoveImage() {
    const path = extractStoragePath(imageUrl)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl('')
  }

  async function handleNewImage(url) {
    const path = extractStoragePath(imageUrl)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl(url)
  }

  async function handleDelete() {
    setDeleting(true)
    const path = extractStoragePath(subcategory.image_url)
    if (path) await supabase.storage.from('images').remove([path])
    const { error } = await supabase.from('subcategories').delete().eq('id', subcategory.id)
    if (error) { alert('Error: ' + error.message); setDeleting(false); return }
    onDeleted(subcategory.id)
    onClose()
  }

  return (
    <Modal title="Edit category" onClose={onClose}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Image</label>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt={name} className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
              <button type="button" onClick={handleRemoveImage} className="text-sm text-red-400 hover:text-red-300">
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
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        <div className="border-t border-gray-700 pt-4">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors">
              Delete category
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-400 text-center">Items in this category will become uncategorized. This cannot be undone.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors">Cancel</button>
                <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg py-2 transition-colors">
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
