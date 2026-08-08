import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'

const MARKER_ICON = '/mokoko.png'

export default function AddMarkerModal({ mapId, x, y, onClose, onAdded }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('map_markers')
      .insert({ map_id: mapId, x, y, icon: MARKER_ICON, title: title.trim() || null })
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
    <Modal title="New marker" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <img src={MARKER_ICON} alt="" className="w-12 h-12 object-contain" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Add marker'}
        </button>
      </form>
    </Modal>
  )
}
