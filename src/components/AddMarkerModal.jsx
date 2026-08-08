import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

const MARKER_ICON = '/mokoko.png'

export default function AddMarkerModal({ mapId, x, y, nextNumber, onClose, onAdded }) {
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('map_markers')
      .insert({ map_id: mapId, x, y, icon: MARKER_ICON, title: `Mokoko #${nextNumber}` })
      .select()
      .single()
    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }
    if (imageUrl) {
      const { error: noteError } = await supabase.from('map_marker_notes').insert({ marker_id: data.id, image_url: imageUrl })
      if (noteError) alert('Marker added, but photo failed to attach: ' + noteError.message)
    }
    onAdded(data)
    onClose()
    setSaving(false)
  }

  return (
    <Modal title="New marker" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <img src={MARKER_ICON} alt="" className="w-12 h-12 object-contain" />
          <p className="text-sm font-semibold text-gray-200">Mokoko #{nextNumber}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Photo (optional)</label>
          <ImageUpload bucket="map-notes" onUploaded={setImageUrl} />
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
