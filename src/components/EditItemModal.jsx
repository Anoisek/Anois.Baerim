import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { itemImages } from '../utils/itemImages'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

const STEPS = [
  { step: 0, label: 'Craft' },
  { step: 1, label: '+0 → +1' }, { step: 2, label: '+1 → +2' }, { step: 3, label: '+2 → +3' },
  { step: 4, label: '+3 → +4' }, { step: 5, label: '+4 → +5' }, { step: 6, label: '+5 → +6' },
  { step: 7, label: '+6 → +7' }, { step: 8, label: '+7 → +8' }, { step: 9, label: '+8 → +9' },
]

function extractStoragePath(url) {
  if (!url) return null
  const marker = '/object/public/images/'
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

export default function EditItemModal({ item, categoryId, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(item.name)
  const [imageUrls, setImageUrls] = useState(itemImages(item))
  const [subcategoryId, setSubcategoryId] = useState(item.subcategory_id ?? '')
  const [subcategories, setSubcategories] = useState([])
  const [allMaterials, setAllMaterials] = useState([])
  const [stepMaterials, setStepMaterials] = useState({})  // { step: { materialId: qty } }
  const [stepYang, setStepYang] = useState({})            // { step: string }
  const [activeStep, setActiveStep] = useState(0)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('item_materials').select('material_id, quantity, step').eq('item_id', item.id),
      supabase.from('item_step_yang').select('step, yang_cost').eq('item_id', item.id),
      categoryId ? supabase.from('subcategories').select('*').eq('category_id', categoryId).order('created_at') : Promise.resolve({ data: [] }),
    ]).then(([matsRes, imRes, yangRes, subRes]) => {
      setAllMaterials(matsRes.data ?? [])
      setSubcategories(subRes.data ?? [])

      const sm = {}
      for (const row of imRes.data ?? []) {
        if (!sm[row.step]) sm[row.step] = {}
        sm[row.step][row.material_id] = row.quantity
      }
      setStepMaterials(sm)

      const sy = {}
      for (const row of yangRes.data ?? []) sy[row.step] = String(row.yang_cost)
      setStepYang(sy)
    })
  }, [item.id, categoryId])

  function toggleMaterial(step, materialId) {
    setStepMaterials(prev => {
      const stepData = prev[step] ?? {}
      if (stepData[materialId] !== undefined) {
        const next = { ...stepData }
        delete next[materialId]
        return { ...prev, [step]: next }
      }
      return { ...prev, [step]: { ...stepData, [materialId]: 1 } }
    })
  }

  function setQty(step, materialId, val) {
    setStepMaterials(prev => ({ ...prev, [step]: { ...(prev[step] ?? {}), [materialId]: val } }))
  }

  function countForStep(step) {
    return Object.keys(stepMaterials[step] ?? {}).length + (stepYang[step] ? 1 : 0)
  }

  async function removeImageAt(i) {
    const path = extractStoragePath(imageUrls[i])
    if (path) await supabase.storage.from('images').remove([path])
    setImageUrls(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await supabase
      .from('items')
      .update({ name: name.trim(), image_urls: imageUrls, image_url: imageUrls[0] ?? null, subcategory_id: subcategoryId || null })
      .eq('id', item.id)
      .select()
      .single()

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    // Replace all item_materials
    await supabase.from('item_materials').delete().eq('item_id', item.id)
    const matRows = []
    for (const [step, mats] of Object.entries(stepMaterials)) {
      for (const [material_id, quantity] of Object.entries(mats)) {
        if (Number(quantity) > 0) matRows.push({ item_id: item.id, material_id, quantity: Number(quantity), step: Number(step) })
      }
    }
    if (matRows.length > 0) await supabase.from('item_materials').insert(matRows)

    // Replace all yang costs
    await supabase.from('item_step_yang').delete().eq('item_id', item.id)
    const yangRows = []
    for (const [step, val] of Object.entries(stepYang)) {
      const cost = parseInt(val, 10)
      if (!isNaN(cost) && cost > 0) yangRows.push({ item_id: item.id, step: Number(step), yang_cost: cost })
    }
    if (yangRows.length > 0) await supabase.from('item_step_yang').insert(yangRows)

    onUpdated(data)
    onClose()
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const paths = imageUrls.map(extractStoragePath).filter(Boolean)
    if (paths.length > 0) await supabase.storage.from('images').remove(paths)
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) { alert('Error: ' + error.message); setDeleting(false); return }
    onDeleted(item.id)
    onClose()
  }

  const filtered = allMaterials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  const currentStepMats = stepMaterials[activeStep] ?? {}

  return (
    <Modal title="Edit item" onClose={onClose}>
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
          <label className="text-sm text-gray-400">Images (add several to cycle through them)</label>
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
                  <button
                    type="button"
                    onClick={() => removeImageAt(i)}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <ImageUpload onUploaded={url => setImageUrls(prev => [...prev, url])} />
        </div>

        {subcategories.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Category</label>
            <select
              value={subcategoryId}
              onChange={e => setSubcategoryId(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            >
              <option value="">Uncategorized</option>
              {subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Materials by step</label>
          <div className="flex flex-wrap gap-1">
            {STEPS.map(({ step, label }) => (
              <button
                key={step}
                type="button"
                onClick={() => { setActiveStep(step); setSearch('') }}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors relative ${activeStep === step ? 'bg-yellow-400 text-gray-950' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {label}
                {countForStep(step) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {countForStep(step)}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
            <span className="text-yellow-400 text-sm font-semibold shrink-0">Yang cost</span>
            <input
              type="number"
              min="0"
              placeholder="leave empty if none"
              value={stepYang[activeStep] ?? ''}
              onChange={e => setStepYang(prev => ({ ...prev, [activeStep]: e.target.value }))}
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
                  checked={currentStepMats[mat.id] !== undefined}
                  onChange={() => toggleMaterial(activeStep, mat.id)}
                  className="accent-yellow-400"
                />
                {mat.image_url
                  ? <img src={mat.image_url} alt={mat.name} className="w-7 h-7 object-contain" />
                  : <span className="w-7 text-center text-lg">🧪</span>}
                <span className="text-sm text-white flex-1">{mat.name}</span>
                {currentStepMats[mat.id] !== undefined && (
                  <input
                    type="number"
                    min="1"
                    value={currentStepMats[mat.id]}
                    onChange={e => setQty(activeStep, mat.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="bg-gray-700 border border-gray-500 rounded px-2 py-1 w-16 text-right text-sm focus:outline-none focus:border-yellow-400"
                  />
                )}
              </div>
            ))}
          </div>
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
              Delete item
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-400 text-center">Are you sure? This cannot be undone.</p>
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
