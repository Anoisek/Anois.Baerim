import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'

export default function EditMapModal({ map, onClose, onUpdated }) {
  const [name, setName] = useState(map.name ?? '')
  const [region, setRegion] = useState(map.region ?? '')
  const [mark, setMark] = useState(map.mark ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || !region.trim() || !mark.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('maps')
      .update({ name: name.trim(), region: region.trim(), mark: mark.trim() })
      .eq('id', map.id)
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
