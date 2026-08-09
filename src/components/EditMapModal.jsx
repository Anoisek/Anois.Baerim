import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

export default function EditMapModal({ map, onClose, onUpdated }) {
  const [name, setName] = useState(map.name ?? '')
  const [region, setRegion] = useState(map.region ?? '')
  const [mark, setMark] = useState(map.mark ?? '')
  const [imageUrl, setImageUrl] = useState(map.image_url ?? '')
  const [dimensions, setDimensions] = useState({ width: map.width, height: map.height })
  const [maxMokoko, setMaxMokoko] = useState(map.max_mokoko != null ? String(map.max_mokoko) : '')
  const [adminOnly, setAdminOnly] = useState(!!map.admin_only)
  const [saving, setSaving] = useState(false)

  function handleUploaded(url) {
    setImageUrl(url)
    setDimensions(null)
    const img = new Image()
    img.onload = () => setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = url
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || !region.trim() || !mark.trim() || !imageUrl || !dimensions) return
    setSaving(true)
    const oldWidth = map.width
    const oldHeight = map.height
    const { data, error } = await supabase
      .from('maps')
      .update({
        name: name.trim(),
        region: region.trim(),
        mark: mark.trim(),
        image_url: imageUrl,
        width: dimensions.width,
        height: dimensions.height,
        max_mokoko: maxMokoko.trim() === '' ? null : Number(maxMokoko),
        admin_only: adminOnly,
      })
      .eq('id', map.id)
      .select()
      .single()
    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }
    if (oldWidth && oldHeight && (dimensions.width !== oldWidth || dimensions.height !== oldHeight)) {
      const { data: markers } = await supabase.from('map_markers').select('id, x, y').eq('map_id', map.id)
      if (markers?.length) {
        const scaleX = dimensions.width / oldWidth
        const scaleY = dimensions.height / oldHeight
        await Promise.all(markers.map(mk =>
          supabase.from('map_markers').update({
            x: Math.round(mk.x * scaleX),
            y: Math.round(mk.y * scaleY),
          }).eq('id', mk.id)
        ))
      }
    }
    onUpdated(data)
    onClose()
    setSaving(false)
  }

  const canSubmit = name.trim() && region.trim() && mark.trim() && imageUrl && dimensions

  return (
    <Modal title="Edit map" onClose={onClose}>
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
          <label className="text-sm text-gray-400">Max mokoko on this map</label>
          <input
            type="number"
            min="0"
            value={maxMokoko}
            onChange={e => setMaxMokoko(e.target.value)}
            placeholder="e.g. 35 (leave empty if unknown)"
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Map image</label>
          {imageUrl && (
            <img src={imageUrl} alt="" className="w-full max-h-40 object-contain rounded-lg border border-gray-600 bg-gray-950" />
          )}
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
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </Modal>
  )
}
