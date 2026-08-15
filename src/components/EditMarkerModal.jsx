import { useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'
import { deleteImages } from '../utils/imageStorage'

function daysUntil(isoDate) {
  if (!isoDate) return 0
  const ms = new Date(isoDate).getTime() - Date.now()
  return ms > 0 ? Math.ceil(ms / 86400000) : 0
}

export default function EditMarkerModal({ marker, onClose, onUpdated, onDeleted }) {
  const [title, setTitle] = useState(marker.title ?? '')
  const [delayDays, setDelayDays] = useState(String(daysUntil(marker.visible_at)))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const days = Number(delayDays) || 0
    const visibleAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
    const { data, error } = await db
      .from('map_markers')
      .update({ title: title.trim() || null, visible_at: visibleAt })
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
    const { data: notes } = await db.from('map_marker_notes').select('image_url').eq('marker_id', marker.id)
    await deleteImages((notes ?? []).map(n => n.image_url), 'map-notes')
    const { error } = await db.from('map_markers').delete().eq('id', marker.id)
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
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Delay before it's visible to others</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={delayDays}
              onChange={e => setDelayDays(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
            />
            <span className="text-sm text-gray-400">days</span>
          </div>
          <p className="text-xs text-gray-500">
            {daysUntil(marker.visible_at) > 0
              ? `Currently hidden from everyone except you for ${daysUntil(marker.visible_at)} more day(s).`
              : '0 = visible to everyone right away. You always see it either way.'}
          </p>
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
