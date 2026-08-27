import { useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'
import IconDbPicker from './IconDbPicker'
import ExistingImagePicker from './ExistingImagePicker'
import { deleteImages } from '../utils/imageStorage'

export default function EditBonusItemModal({ item, existingImages, isImageUsedElsewhere, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(item.name)
  const [imageUrl, setImageUrl] = useState(item.image_url ?? '')
  const [value, setValue] = useState(String(item.value ?? ''))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleRemoveImage() {
    if (!isImageUsedElsewhere(imageUrl, item.id)) await deleteImages(imageUrl)
    setImageUrl('')
  }

  async function handleNewImage(url) {
    if (imageUrl && !isImageUsedElsewhere(imageUrl, item.id)) await deleteImages(imageUrl)
    setImageUrl(url)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || value === '') return
    setSaving(true)

    const { data, error } = await db
      .from('bonus_items')
      .update({ name: name.trim(), image_url: imageUrl || null, value: parseFloat(value) })
      .eq('id', item.id)
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    onUpdated(data)
    onClose()
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    if (imageUrl && !isImageUsedElsewhere(imageUrl, item.id)) await deleteImages(imageUrl)

    const { error } = await db.from('bonus_items').delete().eq('id', item.id)
    if (error) {
      alert('Error: ' + error.message)
      setDeleting(false)
      return
    }

    onDeleted(item.id)
    onClose()
  }

  return (
    <Modal title="Edit item" onClose={onClose}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Bonus value (%)</label>
          <input
            type="number"
            step="any"
            value={value}
            onChange={e => setValue(e.target.value)}
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
            <div className="flex flex-wrap gap-2">
              <ImageUpload onUploaded={handleNewImage} />
              <IconDbPicker onUploaded={handleNewImage} />
              <ExistingImagePicker images={existingImages} onUploaded={handleNewImage} />
            </div>
          )}
          {imageUrl && (
            <div className="mt-1">
              <p className="text-xs text-gray-500 mb-1">Replace with new image:</p>
              <div className="flex flex-wrap gap-2">
                <ImageUpload onUploaded={handleNewImage} />
                <IconDbPicker onUploaded={handleNewImage} />
                <ExistingImagePicker images={existingImages} onUploaded={handleNewImage} />
              </div>
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
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors"
            >
              Delete item
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
