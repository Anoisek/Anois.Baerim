import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'

function extractStoragePath(url) {
  if (!url) return null
  const marker = '/object/public/map-notes/'
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

export default function EditMarkerModal({ marker, onClose, onUpdated, onDeleted }) {
  const [title, setTitle] = useState(marker.title ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('map_markers')
      .update({ title: title.trim() || null })
      .eq('id', marker.id)
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

  async function handleDelete() {
    setDeleting(true)
    const { data: notes } = await supabase.from('map_marker_notes').select('image_url').eq('marker_id', marker.id)
    const paths = (notes ?? []).map(n => extractStoragePath(n.image_url)).filter(Boolean)
    if (paths.length > 0) await supabase.storage.from('map-notes').remove(paths)
    const { error } = await supabase.from('map_markers').delete().eq('id', marker.id)
    if (error) { alert('Error: ' + error.message); setDeleting(false); return }
    onDeleted(marker.id)
    onClose()
  }

  return (
    <Modal title="Edit marker" onClose={onClose}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <img src={marker.icon} alt="" className="w-12 h-12 object-contain" />
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
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        <div className="border-t border-gray-700 pt-4">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors">
              Delete marker
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-400 text-center">This will also delete all comments and photos left on this marker. This cannot be undone.</p>
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
