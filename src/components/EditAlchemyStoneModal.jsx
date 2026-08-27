import { useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'
import IconDbPicker from './IconDbPicker'
import { deleteImages } from '../utils/imageStorage'

export default function EditAlchemyStoneModal({ stone, onClose, onSaved }) {
  const [name, setName] = useState(stone.name)
  const [imageUrl, setImageUrl] = useState(stone.image_url ?? '')
  const [saving, setSaving] = useState(false)

  async function handleImageChosen(url) {
    if (imageUrl) await deleteImages(imageUrl)
    setImageUrl(url)
  }

  async function handleRemoveImage() {
    if (imageUrl) await deleteImages(imageUrl)
    setImageUrl('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await db
      .from('alchemy_stones')
      .update({ name: name.trim(), image_url: imageUrl || null })
      .eq('id', stone.id)
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    onSaved(data)
    onClose()
    setSaving(false)
  }

  return (
    <Modal title="Edit stone type" onClose={onClose}>
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

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Image</label>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
              <button type="button" onClick={handleRemoveImage} className="text-sm text-red-400 hover:text-red-300">
                Remove image
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <ImageUpload onUploaded={handleImageChosen} />
              <IconDbPicker onUploaded={handleImageChosen} />
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
      </form>
    </Modal>
  )
}
