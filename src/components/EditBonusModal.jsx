import { useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'
import { deleteImages } from '../utils/imageStorage'

export default function EditBonusModal({ bonus, items, isImageUsedElsewhere, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(bonus.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await db
      .from('bonuses')
      .update({ name: name.trim() })
      .eq('id', bonus.id)
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

    const itemIds = items.map(i => i.id)
    const images = [...new Set(items.map(i => i.image_url).filter(Boolean))].filter(url => !isImageUsedElsewhere(url, itemIds))
    if (images.length > 0) await deleteImages(images)
    await db.from('bonus_items').delete().eq('bonus_id', bonus.id)

    const { error } = await db.from('bonuses').delete().eq('id', bonus.id)
    if (error) {
      alert('Error: ' + error.message)
      setDeleting(false)
      return
    }

    onDeleted(bonus.id)
    onClose()
  }

  return (
    <Modal title="Edit bonus" onClose={onClose}>
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
              Delete bonus
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-400 text-center">Delete this bonus and all its items? This cannot be undone.</p>
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
