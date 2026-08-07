import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { parseYang } from '../utils/formatYang'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

function extractStoragePath(url) {
  if (!url) return null
  const marker = '/object/public/images/'
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

export default function EditMaterialModal({ material, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(material.name)
  const [imageUrl, setImageUrl] = useState(material.image_url ?? '')
  const [tag, setTag] = useState(material.is_upgrade_scroll ? 'scroll' : material.is_seal ? 'seal' : material.is_item ? 'item' : '')
  const [isCraftable, setIsCraftable] = useState(material.is_craftable ?? false)
  const [craftYangCost, setCraftYangCost] = useState(material.craft_yang_cost ? String(material.craft_yang_cost) : '')
  const [allMaterials, setAllMaterials] = useState([])
  const [components, setComponents] = useState({}) // { materialId: qty }
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('material_materials').select('component_id, quantity').eq('material_id', material.id),
    ]).then(([matsRes, compRes]) => {
      setAllMaterials((matsRes.data ?? []).filter(m => m.id !== material.id))
      const c = {}
      for (const row of compRes.data ?? []) c[row.component_id] = row.quantity
      setComponents(c)
    })
  }, [material.id])

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

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await supabase
      .from('materials')
      .update({
        name: name.trim(),
        image_url: imageUrl || null,
        is_upgrade_scroll: tag === 'scroll',
        is_seal: tag === 'seal',
        is_item: tag === 'item',
        is_craftable: isCraftable,
        craft_yang_cost: isCraftable ? (parseYang(craftYangCost) || null) : null,
      })
      .eq('id', material.id)
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    await supabase.from('material_materials').delete().eq('material_id', material.id)
    if (isCraftable) {
      const rows = Object.entries(components)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([component_id, quantity]) => ({ material_id: material.id, component_id, quantity: Number(quantity) }))
      if (rows.length > 0) await supabase.from('material_materials').insert(rows)
    }

    onUpdated(data)
    onClose()
    setSaving(false)
  }

  async function handleRemoveImage() {
    const path = extractStoragePath(material.image_url)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl('')
  }

  async function handleNewImage(url) {
    // Remove old image from storage if it exists
    const path = extractStoragePath(imageUrl)
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrl(url)
  }

  async function handleDelete() {
    setDeleting(true)

    const [{ count: usedInItems }, { count: usedInMaterials }] = await Promise.all([
      supabase.from('item_materials').select('item_id', { count: 'exact', head: true }).eq('material_id', material.id),
      supabase.from('material_materials').select('material_id', { count: 'exact', head: true }).eq('component_id', material.id),
    ])

    if (usedInItems > 0) {
      alert(`Cannot delete — this material is used in ${usedInItems} item(s).`)
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    if (usedInMaterials > 0) {
      alert(`Cannot delete — this material is used as a component in ${usedInMaterials} other material(s).`)
      setDeleting(false)
      setConfirmDelete(false)
      return
    }

    const path = extractStoragePath(material.image_url)
    if (path) await supabase.storage.from('images').remove([path])

    const { error } = await supabase.from('materials').delete().eq('id', material.id)
    if (error) {
      alert('Error: ' + error.message)
      setDeleting(false)
      return
    }

    onDeleted(material.id)
    onClose()
  }

  const filtered = allMaterials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Modal title="Edit material" onClose={onClose}>
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

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Image</label>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt={name} className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Remove image
              </button>
            </div>
          ) : (
            <ImageUpload onUploaded={handleNewImage} />
          )}
          {imageUrl && (
            <div className="mt-1">
              <p className="text-xs text-gray-500 mb-1">Replace with new image:</p>
              <ImageUpload onUploaded={handleNewImage} />
            </div>
          )}
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

            <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
              <span className="text-yellow-400 text-sm font-semibold shrink-0">Craft yang cost</span>
              <input
                type="text"
                placeholder="e.g. 50kk"
                value={craftYangCost}
                onChange={e => setCraftYangCost(e.target.value)}
                className="bg-transparent flex-1 text-white text-sm focus:outline-none text-right"
              />
              <span className="text-gray-400 text-sm shrink-0">yang</span>
            </div>

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
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        <div className="border-t border-gray-700 pt-4">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors"
            >
              Delete material
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-400 text-center">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg py-2 transition-colors"
                >
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
