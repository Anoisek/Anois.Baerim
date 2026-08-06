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

export default function EditMaterialModal({ material, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(material.name)
  const [imageUrl, setImageUrl] = useState(material.image_url ?? '')
  const [isUpgradeScroll, setIsUpgradeScroll] = useState(material.is_upgrade_scroll ?? false)
  const [isSeal, setIsSeal] = useState(material.is_seal ?? false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await supabase
      .from('materials')
      .update({ name: name.trim(), image_url: imageUrl || null, is_upgrade_scroll: isUpgradeScroll, is_seal: isSeal })
      .eq('id', material.id)
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
    const path = extractStoragePath(material.image_url)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl('')
  }

  async function handleNewImage(url) {
    // Remove old image from storage if it exists
    const path = extractStoragePath(imageUrl)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl(url)
  }

  async function handleDelete() {
    setDeleting(true)

    const { count } = await supabase
      .from('item_materials')
      .select('item_id', { count: 'exact', head: true })
      .eq('material_id', material.id)

    if (count > 0) {
      alert(`Cannot delete — this material is used in ${count} item(s).`)
      setDeleting(false)
      setConfirmDelete(false)
      return
    }

    const path = extractStoragePath(material.image_url)
    if (path) await supabase.storage.from('images').remove([path])

    const { error } = await supabase.from('materials').delete().eq('id', material.id)
    if (error) {
      alert('Error: ' + error.message)
      setDeleting(false)
      return
    }

    onDeleted(material.id)
    onClose()
  }

  return (
    <Modal title="Edit material" onClose={onClose}>
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
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-sm text-red-400 hover:text-red-300"
              >
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

        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={isUpgradeScroll}
            onChange={e => setIsUpgradeScroll(e.target.checked)}
            className="accent-yellow-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">Upgrade Scroll</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={isSeal}
            onChange={e => setIsSeal(e.target.checked)}
            className="accent-yellow-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">Seal of Gods</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        <div className="border-t border-gray-700 pt-4">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors"
            >
              Delete material
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-400 text-center">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg py-2 transition-colors"
                >
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
