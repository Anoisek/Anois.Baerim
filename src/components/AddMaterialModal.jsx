import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

export default function AddMaterialModal({ onClose, onAdded }) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isUpgradeScroll, setIsUpgradeScroll] = useState(false)
  const [isSeal, setIsSeal] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('materials')
      .insert({ name: name.trim(), image_url: imageUrl || null, is_upgrade_scroll: isUpgradeScroll, is_seal: isSeal })
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
    <Modal title="New material" onClose={onClose}>
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
          <label className="text-sm text-gray-400">Image (optional)</label>
          <ImageUpload onUploaded={setImageUrl} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={isUpgradeScroll}
            onChange={e => setIsUpgradeScroll(e.target.checked)}
            className="accent-yellow-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">Upgrade Scroll</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={isSeal}
            onChange={e => setIsSeal(e.target.checked)}
            className="accent-yellow-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">Seal of Gods</span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Add material'}
        </button>
      </form>
    </Modal>
  )
}
