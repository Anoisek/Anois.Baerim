import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { parseYang } from '../utils/formatYang'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

const STEPS = [
  { step: 0, label: 'Craft' },
  { step: 1, label: '+0 → +1' },
  { step: 2, label: '+1 → +2' },
  { step: 3, label: '+2 → +3' },
  { step: 4, label: '+3 → +4' },
  { step: 5, label: '+4 → +5' },
  { step: 6, label: '+5 → +6' },
  { step: 7, label: '+6 → +7' },
  { step: 8, label: '+7 → +8' },
  { step: 9, label: '+8 → +9' },
]

export default function AddItemModal({ categoryId, subcategoryId, nextSortOrder, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [allMaterials, setAllMaterials] = useState([])
  const [allItems, setAllItems] = useState([])
  const [pickerMode, setPickerMode] = useState('materials') // 'materials' | 'items'
  const [stepMaterials, setStepMaterials] = useState({})  // { step: { materialId: qty } }
  const [stepItems, setStepItems] = useState({})          // { step: { itemId: qty } }
  const [stepYang, setStepYang] = useState({})            // { step: yang_cost string }
  const [stepMaxPity, setStepMaxPity] = useState({})       // { step: max_pity string }
  const [activeStep, setActiveStep] = useState(0)
  const [search, setSearch] = useState('')
  const [copySearch, setCopySearch] = useState('')
  const [copying, setCopying] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('materials').select('*').order('name').then(({ data }) => {
      setAllMaterials(data ?? [])
    })
    supabase.from('items').select('id, name, image_url').order('name').then(({ data }) => {
      setAllItems(data ?? [])
    })
  }, [])

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
    setStepMaterials(prev => ({
      ...prev,
      [step]: { ...(prev[step] ?? {}), [materialId]: val },
    }))
  }

  function toggleItem(step, itemId) {
    setStepItems(prev => {
      const stepData = prev[step] ?? {}
      if (stepData[itemId] !== undefined) {
        const next = { ...stepData }
        delete next[itemId]
        return { ...prev, [step]: next }
      }
      return { ...prev, [step]: { ...stepData, [itemId]: 1 } }
    })
  }

  function setItemQty(step, itemId, val) {
    setStepItems(prev => ({
      ...prev,
      [step]: { ...(prev[step] ?? {}), [itemId]: val },
    }))
  }

  async function copyRecipeFrom(sourceItemId) {
    setCopying(true)
    const [matRes, itemRes, yangRes] = await Promise.all([
      supabase.from('item_materials').select('material_id, quantity, step').eq('item_id', sourceItemId),
      supabase.from('item_items').select('component_item_id, quantity, step').eq('item_id', sourceItemId),
      supabase.from('item_step_yang').select('step, yang_cost, max_pity').eq('item_id', sourceItemId),
    ])

    const sm = {}
    for (const row of matRes.data ?? []) {
      if (!sm[row.step]) sm[row.step] = {}
      sm[row.step][row.material_id] = row.quantity
    }
    setStepMaterials(sm)

    const si = {}
    for (const row of itemRes.data ?? []) {
      if (!si[row.step]) si[row.step] = {}
      si[row.step][row.component_item_id] = row.quantity
    }
    setStepItems(si)

    const sy = {}
    const smp = {}
    for (const row of yangRes.data ?? []) {
      if (row.yang_cost) sy[row.step] = String(row.yang_cost)
      if (row.max_pity) smp[row.step] = String(row.max_pity)
    }
    setStepYang(sy)
    setStepMaxPity(smp)

    setCopySearch('')
    setCopying(false)
  }

  function countForStep(step) {
    const mats = Object.keys(stepMaterials[step] ?? {}).length
    const its = Object.keys(stepItems[step] ?? {}).length
    const yang = stepYang[step] ? 1 : 0
    const maxPity = stepMaxPity[step] ? 1 : 0
    return mats + its + yang + maxPity
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data: item, error } = await supabase
      .from('items')
      .insert({ name: name.trim(), category_id: categoryId, subcategory_id: subcategoryId || null, image_urls: imageUrls, image_url: imageUrls[0] ?? null, sort_order: nextSortOrder ?? 0 })
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    // Insert materials
    const matRows = []
    for (const [step, mats] of Object.entries(stepMaterials)) {
      for (const [material_id, quantity] of Object.entries(mats)) {
        if (Number(quantity) > 0) {
          matRows.push({ item_id: item.id, material_id, quantity: Number(quantity), step: Number(step) })
        }
      }
    }
    if (matRows.length > 0) {
      const { error: err } = await supabase.from('item_materials').insert(matRows)
      if (err) { alert('Error saving materials: ' + err.message); setSaving(false); return }
    }

    // Insert item ingredients
    const itemRows = []
    for (const [step, its] of Object.entries(stepItems)) {
      for (const [component_item_id, quantity] of Object.entries(its)) {
        if (Number(quantity) > 0) {
          itemRows.push({ item_id: item.id, component_item_id, quantity: Number(quantity), step: Number(step) })
        }
      }
    }
    if (itemRows.length > 0) {
      const { error: err } = await supabase.from('item_items').insert(itemRows)
      if (err) { alert('Error saving item ingredients: ' + err.message); setSaving(false); return }
    }

    // Insert yang costs / max pity
    // Steps that actually have materials/items default to max pity 1 unless overridden or cleared.
    const yangRows = []
    const contentSteps = new Set([...Object.keys(stepMaterials), ...Object.keys(stepItems)].map(Number))
    const steps = new Set([...contentSteps, ...Object.keys(stepYang).map(Number), ...Object.keys(stepMaxPity).map(Number)])
    for (const step of steps) {
      const cost = parseYang(stepYang[step])
      const rawMaxPity = stepMaxPity[step]
      const maxPity = rawMaxPity !== undefined ? parseInt(rawMaxPity, 10) : (contentSteps.has(step) ? 1 : NaN)
      if ((cost !== '' && cost > 0) || (!isNaN(maxPity) && maxPity > 0)) {
        yangRows.push({
          item_id: item.id,
          step: Number(step),
          yang_cost: cost !== '' && cost > 0 ? cost : 0,
          max_pity: !isNaN(maxPity) && maxPity > 0 ? maxPity : null,
        })
      }
    }
    if (yangRows.length > 0) {
      const { error: err } = await supabase.from('item_step_yang').insert(yangRows)
      if (err) { alert('Error saving yang costs: ' + err.message); setSaving(false); return }
    }

    onAdded(item)
    onClose()
    setSaving(false)
  }

  const filteredMaterials = allMaterials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  const filteredItems = allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  const currentStepMats = stepMaterials[activeStep] ?? {}
  const currentStepItems = stepItems[activeStep] ?? {}

  return (
    <Modal title="Add item" onClose={onClose}>
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

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Images (optional — add several to cycle through them)</label>
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
                  <button
                    type="button"
                    onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
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

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Copy recipe from existing item (optional)</label>
          <input
            type="text"
            placeholder="Search item to copy from..."
            value={copySearch}
            onChange={e => setCopySearch(e.target.value)}
            disabled={copying}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 disabled:opacity-50"
          />
          {copySearch.trim().length > 0 && (
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
              {allItems.filter(i => i.name.toLowerCase().includes(copySearch.toLowerCase())).length === 0 && (
                <p className="text-gray-500 text-sm p-2">No items found.</p>
              )}
              {allItems.filter(i => i.name.toLowerCase().includes(copySearch.toLowerCase())).map(it => (
                <button
                  key={it.id}
                  type="button"
                  disabled={copying}
                  onClick={() => copyRecipeFrom(it.id)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 text-left disabled:opacity-50"
                >
                  {it.image_url
                    ? <img src={it.image_url} alt={it.name} className="w-7 h-7 object-contain" />
                    : <span className="w-7 text-center text-lg">⚔️</span>}
                  <span className="text-sm text-white flex-1">{it.name}</span>
                  <span className="text-xs text-yellow-400 shrink-0">Copy</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Ingredients by step</label>

          {/* Step tabs */}
          <div className="flex flex-wrap gap-1">
            {STEPS.map(({ step, label }) => (
              <button
                key={step}
                type="button"
                onClick={() => { setActiveStep(step); setSearch('') }}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors relative ${
                  activeStep === step
                    ? 'bg-yellow-400 text-gray-950'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
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

          {/* Yang cost for current step */}
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
            <span className="text-yellow-400 text-sm font-semibold shrink-0">Yang cost</span>
            <input
              type="text"
              placeholder="e.g. 50kk"
              value={stepYang[activeStep] ?? ''}
              onChange={e => setStepYang(prev => ({ ...prev, [activeStep]: e.target.value }))}
              className="bg-transparent flex-1 text-white text-sm focus:outline-none text-right"
            />
            <span className="text-gray-400 text-sm shrink-0">yang</span>
          </div>

          {/* Max pity for current step (upgrade steps only) */}
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
            <span className="text-yellow-400 text-sm font-semibold shrink-0">Max pity</span>
            <input
              type="number"
              min="1"
              placeholder="no limit"
              value={stepMaxPity[activeStep] ?? 1}
              onChange={e => setStepMaxPity(prev => ({ ...prev, [activeStep]: e.target.value }))}
              className="bg-transparent flex-1 text-white text-sm focus:outline-none text-right"
            />
          </div>

          {/* Materials / Items switch */}
          <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setPickerMode('materials'); setSearch('') }}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                pickerMode === 'materials' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              🧪 Materials
            </button>
            <button
              type="button"
              onClick={() => { setPickerMode('items'); setSearch('') }}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                pickerMode === 'items' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              ⚔️ Items
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder={pickerMode === 'materials' ? 'Search material...' : 'Search item...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          />

          {pickerMode === 'materials' ? (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
              {filteredMaterials.length === 0 && (
                <p className="text-gray-500 text-sm p-2">No materials found.</p>
              )}
              {filteredMaterials.map(mat => (
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
          ) : (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
              {filteredItems.length === 0 && (
                <p className="text-gray-500 text-sm p-2">No items found.</p>
              )}
              {filteredItems.map(it => (
                <div key={it.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={currentStepItems[it.id] !== undefined}
                    onChange={() => toggleItem(activeStep, it.id)}
                    className="accent-yellow-400"
                  />
                  {it.image_url
                    ? <img src={it.image_url} alt={it.name} className="w-7 h-7 object-contain" />
                    : <span className="w-7 text-center text-lg">⚔️</span>}
                  <span className="text-sm text-white flex-1">{it.name}</span>
                  {currentStepItems[it.id] !== undefined && (
                    <input
                      type="number"
                      min="1"
                      value={currentStepItems[it.id]}
                      onChange={e => setItemQty(activeStep, it.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-700 border border-gray-500 rounded px-2 py-1 w-16 text-right text-sm focus:outline-none focus:border-yellow-400"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Add item'}
        </button>
      </form>
    </Modal>
  )
}
