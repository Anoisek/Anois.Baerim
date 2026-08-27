import { useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'
import IconDbPicker from './IconDbPicker'
import ExistingImagePicker from './ExistingImagePicker'

export default function AddBonusItemModal({ bonusId, nextSortOrder, existingImages, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || value === '') return
    setSaving(true)
    const { data, error } = await db
      .from('bonus_items')
      .insert({
        bonus_id: bonusId,
        name: name.trim(),
        image_url: imageUrl || null,
        value: parseFloat(value),
        sort_order: nextSortOrder ?? 0,
      })
      .select()
      .single()
    if (error) {
      alert('Error: ' + error.message)
    } else {
      onAdded(data)
      onClose()
    }
    setSaving(false)
  }

  return (
    <Modal title="New item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Image (optional)</label>
          <div className="flex flex-wrap gap-2">
            <ImageUpload onUploaded={setImageUrl} />
            <IconDbPicker onUploaded={setImageUrl} />
            <ExistingImagePicker images={existingImages} onUploaded={setImageUrl} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Add item'}
        </button>
      </form>
    </Modal>
  )
}
