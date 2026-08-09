import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

export default function AddMapModal({ nextSortOrder, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [mark, setMark] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [dimensions, setDimensions] = useState(null)
  const [adminOnly, setAdminOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleUploaded(url) {
    setImageUrl(url)
    setDimensions(null)
    const img = new Image()
    img.onload = () => setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = url
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !region.trim() || !mark.trim() || !imageUrl || !dimensions) return
    setSaving(true)
    const { data, error } = await supabase
      .from('maps')
      .insert({
        name: name.trim(),
        region: region.trim(),
        mark: mark.trim(),
        image_url: imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        sort_order: nextSortOrder ?? 0,
        admin_only: adminOnly,
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

  const canSubmit = name.trim() && region.trim() && mark.trim() && imageUrl && dimensions

  return (
    <Modal title="Add map" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Region</label>
          <input
            type="text"
            value={region}
            onChange={e => setRegion(e.target.value)}
            required
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Mark (short code)</label>
          <input
            type="text"
            value={mark}
            onChange={e => setMark(e.target.value)}
            required
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Map image</label>
          <ImageUpload onUploaded={handleUploaded} />
          {imageUrl && !dimensions && (
            <p className="text-xs text-gray-500">Detecting image size...</p>
          )}
          {dimensions && (
            <p className="text-xs text-gray-500">{dimensions.width} × {dimensions.height}</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={adminOnly}
            onChange={e => setAdminOnly(e.target.checked)}
            className="accent-yellow-400"
          />
          Only visible to admin
        </label>
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Add map'}
        </button>
      </form>
    </Modal>
  )
}
