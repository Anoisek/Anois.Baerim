import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

export default function AddMaterialModal({ onClose, onAdded }) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [tag, setTag] = useState('')
  const [isCraftable, setIsCraftable] = useState(false)
  const [allMaterials, setAllMaterials] = useState([])
  const [components, setComponents] = useState({}) // { materialId: qty }
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('materials').select('*').order('name').then(({ data }) => {
      setAllMaterials(data ?? [])
    })
  }, [])

  function toggleComponent(materialId) {
    setComponents(prev => {
      if (prev[materialId] !== undefined) {
        const next = { ...prev }
        delete next[materialId]
        return next
      }
      return { ...prev, [materialId]: 1 }
    })
  }

  function setQty(materialId, val) {
    setComponents(prev => ({ ...prev, [materialId]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('materials')
      .insert({
        name: name.trim(),
        image_url: imageUrl || null,
        is_upgrade_scroll: tag === 'scroll',
        is_seal: tag === 'seal',
        is_item: tag === 'item',
        is_craftable: isCraftable,
      })
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    if (isCraftable) {
      const rows = Object.entries(components)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([component_id, quantity]) => ({ material_id: data.id, component_id, quantity: Number(quantity) }))
      if (rows.length > 0) {
        const { error: err } = await supabase.from('material_materials').insert(rows)
        if (err) { alert('Error saving recipe: ' + err.message); setSaving(false); return }
      }
    }

    onAdded(data)
    onClose()
    setSaving(false)
  }

  const filtered = allMaterials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

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
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Tag</label>
          <select
            value={tag}
            onChange={e => setTag(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          >
            <option value="">No tag</option>
            <option value="scroll">Upgrade Scroll</option>
            <option value="seal">Seal of Gods</option>
            <option value="item">Item</option>
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={isCraftable}
            onChange={e => setIsCraftable(e.target.checked)}
            className="accent-green-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">Craftable</span>
        </label>

        {isCraftable && (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400">Crafted from</label>
            <input
              type="text"
              placeholder="Search material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
              {filtered.length === 0 && <p className="text-gray-500 text-sm p-2">No materials found.</p>}
              {filtered.map(mat => (
                <div key={mat.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={components[mat.id] !== undefined}
                    onChange={() => toggleComponent(mat.id)}
                    className="accent-yellow-400"
                  />
                  {mat.image_url
                    ? <img src={mat.image_url} alt={mat.name} className="w-7 h-7 object-contain" />
                    : <span className="w-7 text-center text-lg">🧪</span>}
                  <span className="text-sm text-white flex-1">{mat.name}</span>
                  {components[mat.id] !== undefined && (
                    <input
                      type="number"
                      min="1"
                      value={components[mat.id]}
                      onChange={e => setQty(mat.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-700 border border-gray-500 rounded px-2 py-1 w-16 text-right text-sm focus:outline-none focus:border-yellow-400"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
