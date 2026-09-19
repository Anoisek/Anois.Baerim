import { useState } from 'react'
import Modal from './Modal'

export default function EditChapterModal({ chapter, onClose, onSave }) {
  const [name, setName] = useState(chapter.name)
  const [visible, setVisible] = useState(chapter.visible)
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await onSave(chapter.id, { name: name.trim(), visible })
    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }
    onClose()
  }

  return (
    <Modal title="Edit chapter" onClose={onClose}>
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

        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={visible}
            onChange={e => setVisible(e.target.checked)}
            className="accent-yellow-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">Visible to users</span>
        </label>
        {!visible && (
          <p className="text-xs text-gray-400 -mt-2">
            Users won't see this chapter's button, and every material in this chapter is hidden from their materials list. You still see everything as admin.
          </p>
        )}

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
