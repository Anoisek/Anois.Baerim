import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

export default function AddSubcategoryModal({ categoryId, nextSortOrder, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('subcategories')
      .insert({ name: name.trim(), image_url: imageUrl || null, category_id: categoryId, sort_order: nextSortOrder ?? 0 })
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
    <Modal title="New category" onClose={onClose}>
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
        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Add category'}
        </button>
      </form>
    </Modal>
  )
}
