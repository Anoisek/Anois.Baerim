import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { itemImages } from '../utils/itemImages'
import { parseYang } from '../utils/formatYang'
import { formatItemName, PVP_CATEGORY_ID } from '../utils/itemName'
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
  const [allItems, setAllItems] = useState([])
  const [pickerMode, setPickerMode] = useState('materials') // 'materials' | 'items'
  const [stepMaterials, setStepMaterials] = useState({})  // variant 1: { step: { materialId: qty } }
  const [stepItems, setStepItems] = useState({})          // variant 1: { step: { itemId: qty } }
  const [stepYang, setStepYang] = useState({})            // variant 1: { step: string }
  const [stepMaxPity, setStepMaxPity] = useState({})       // variant 1: { step: max_pity string }
  const [extraVariantMaterials, setExtraVariantMaterials] = useState({}) // variants 2+: { step: { variant: { materialId: qty } } }
  const [extraVariantItems, setExtraVariantItems] = useState({})         // variants 2+: { step: { variant: { itemId: qty } } }
  const [extraVariantYang, setExtraVariantYang] = useState({})           // variants 2+: { step: { variant: string } }
  const [extraVariantMaxPity, setExtraVariantMaxPity] = useState({})     // variants 2+: { step: { variant: string } }
  const [stepVariantCount, setStepVariantCount] = useState({}) // { step: number }
  const [activeVariantByStep, setActiveVariantByStep] = useState({}) // { step: number }
  const [activeStep, setActiveStep] = useState(0)
  const [bulkVariantCount, setBulkVariantCount] = useState('2')
  const [search, setSearch] = useState('')
  const [copySearch, setCopySearch] = useState('')
  const [copyFromVariant, setCopyFromVariant] = useState('1')
  const [copyToVariant, setCopyToVariant] = useState('1')
  const [copying, setCopying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isPvpCategory = categoryId === PVP_CATEGORY_ID

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('items').select('id, name, image_url, category_id').neq('id', item.id).order('name'),
      supabase.from('item_materials').select('material_id, quantity, step, variant').eq('item_id', item.id),
      supabase.from('item_items').select('component_item_id, quantity, step, variant').eq('item_id', item.id),
      supabase.from('item_step_yang').select('step, yang_cost, max_pity, variant').eq('item_id', item.id),
      categoryId ? supabase.from('subcategories').select('*').eq('category_id', categoryId).order('created_at') : Promise.resolve({ data: [] }),
    ]).then(([matsRes, itemsRes, imRes, iiRes, yangRes, subRes]) => {
      setAllMaterials(matsRes.data ?? [])
      setAllItems(itemsRes.data ?? [])
      setSubcategories(subRes.data ?? [])

      const sm = {}
      const evm = {}
      const variantCounts = {}
      for (const row of imRes.data ?? []) {
        const v = row.variant ?? 1
        if (v > (variantCounts[row.step] ?? 1)) variantCounts[row.step] = v
        if (v === 1) {
          if (!sm[row.step]) sm[row.step] = {}
          sm[row.step][row.material_id] = row.quantity
        } else {
          if (!evm[row.step]) evm[row.step] = {}
          if (!evm[row.step][v]) evm[row.step][v] = {}
          evm[row.step][v][row.material_id] = row.quantity
        }
      }
      setStepMaterials(sm)
      setExtraVariantMaterials(evm)

      const si = {}
      const evi = {}
      for (const row of iiRes.data ?? []) {
        const v = row.variant ?? 1
        if (v > (variantCounts[row.step] ?? 1)) variantCounts[row.step] = v
        if (v === 1) {
          if (!si[row.step]) si[row.step] = {}
          si[row.step][row.component_item_id] = row.quantity
        } else {
          if (!evi[row.step]) evi[row.step] = {}
          if (!evi[row.step][v]) evi[row.step][v] = {}
          evi[row.step][v][row.component_item_id] = row.quantity
        }
      }
      setStepItems(si)
      setExtraVariantItems(evi)

      const sy = {}
      const smp = {}
      const evy = {}
      const evmp = {}
      for (const row of yangRes.data ?? []) {
        const v = row.variant ?? 1
        if (v > (variantCounts[row.step] ?? 1)) variantCounts[row.step] = v
        if (v === 1) {
          if (row.yang_cost) sy[row.step] = String(row.yang_cost)
          if (row.max_pity != null) smp[row.step] = String(row.max_pity)
        } else {
          if (row.yang_cost) { if (!evy[row.step]) evy[row.step] = {}; evy[row.step][v] = String(row.yang_cost) }
          if (row.max_pity != null) { if (!evmp[row.step]) evmp[row.step] = {}; evmp[row.step][v] = String(row.max_pity) }
        }
      }
      setStepYang(sy)
      setStepMaxPity(smp)
      setExtraVariantYang(evy)
      setExtraVariantMaxPity(evmp)
      setStepVariantCount(variantCounts)
      setActiveVariantByStep({})
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
    setStepItems(prev => ({ ...prev, [step]: { ...(prev[step] ?? {}), [itemId]: val } }))
  }

  function getStepVariantCount(step) { return stepVariantCount[step] ?? 1 }
  function getActiveVariant(step) { return activeVariantByStep[step] ?? 1 }

  function setVariantCountForStep(step, n) {
    setStepVariantCount(prev => ({ ...prev, [step]: n }))
    setActiveVariantByStep(prev => ({ ...prev, [step]: Math.min(prev[step] ?? 1, n) }))
  }

  function setVariantCountForAllSteps(n) {
    setStepVariantCount(() => {
      const next = {}
      for (let s = 0; s <= 9; s++) next[s] = n
      return next
    })
    setActiveVariantByStep(prev => {
      const next = { ...prev }
      for (let s = 0; s <= 9; s++) next[s] = Math.min(next[s] ?? 1, n)
      return next
    })
  }

  function setActiveVariantForStep(step, v) {
    setActiveVariantByStep(prev => ({ ...prev, [step]: v }))
  }

  function activeMats(step) {
    const v = getActiveVariant(step)
    return v === 1 ? (stepMaterials[step] ?? {}) : (extraVariantMaterials[step]?.[v] ?? {})
  }

  function activeItms(step) {
    const v = getActiveVariant(step)
    return v === 1 ? (stepItems[step] ?? {}) : (extraVariantItems[step]?.[v] ?? {})
  }

  function activeYang(step) {
    const v = getActiveVariant(step)
    return v === 1 ? (stepYang[step] ?? '') : (extraVariantYang[step]?.[v] ?? '')
  }

  function activeMaxPity(step) {
    const v = getActiveVariant(step)
    return v === 1 ? (stepMaxPity[step] ?? '') : (extraVariantMaxPity[step]?.[v] ?? '')
  }

  function toggleActiveMaterial(step, materialId) {
    const v = getActiveVariant(step)
    if (v === 1) { toggleMaterial(step, materialId); return }
    setExtraVariantMaterials(prev => {
      const varData = { ...(prev[step]?.[v] ?? {}) }
      if (varData[materialId] !== undefined) delete varData[materialId]
      else varData[materialId] = 1
      return { ...prev, [step]: { ...(prev[step] ?? {}), [v]: varData } }
    })
  }

  function setActiveMaterialQty(step, materialId, val) {
    const v = getActiveVariant(step)
    if (v === 1) { setQty(step, materialId, val); return }
    setExtraVariantMaterials(prev => ({
      ...prev,
      [step]: { ...(prev[step] ?? {}), [v]: { ...(prev[step]?.[v] ?? {}), [materialId]: val } },
    }))
  }

  function toggleActiveItem(step, itemId) {
    const v = getActiveVariant(step)
    if (v === 1) { toggleItem(step, itemId); return }
    setExtraVariantItems(prev => {
      const varData = { ...(prev[step]?.[v] ?? {}) }
      if (varData[itemId] !== undefined) delete varData[itemId]
      else varData[itemId] = 1
      return { ...prev, [step]: { ...(prev[step] ?? {}), [v]: varData } }
    })
  }

  function setActiveItemQty(step, itemId, val) {
    const v = getActiveVariant(step)
    if (v === 1) { setItemQty(step, itemId, val); return }
    setExtraVariantItems(prev => ({
      ...prev,
      [step]: { ...(prev[step] ?? {}), [v]: { ...(prev[step]?.[v] ?? {}), [itemId]: val } },
    }))
  }

  function setActiveYang(step, val) {
    const v = getActiveVariant(step)
    if (v === 1) { setStepYang(prev => ({ ...prev, [step]: val })); return }
    setExtraVariantYang(prev => ({ ...prev, [step]: { ...(prev[step] ?? {}), [v]: val } }))
  }

  function setActiveMaxPity(step, val) {
    const v = getActiveVariant(step)
    if (v === 1) { setStepMaxPity(prev => ({ ...prev, [step]: val })); return }
    setExtraVariantMaxPity(prev => ({ ...prev, [step]: { ...(prev[step] ?? {}), [v]: val } }))
  }

  function countForStep(step) {
    return Object.keys(activeMats(step)).length + Object.keys(activeItms(step)).length + (activeYang(step) ? 1 : 0) + (activeMaxPity(step) ? 1 : 0)
  }

  async function copyRecipeFrom(sourceItemId) {
    setCopying(true)
    const fromV = Math.max(1, parseInt(copyFromVariant) || 1)
    const toV = Math.max(1, parseInt(copyToVariant) || 1)

    const [matRes, itemRes, yangRes] = await Promise.all([
      supabase.from('item_materials').select('material_id, quantity, step').eq('item_id', sourceItemId).eq('variant', fromV),
      supabase.from('item_items').select('component_item_id, quantity, step').eq('item_id', sourceItemId).eq('variant', fromV),
      supabase.from('item_step_yang').select('step, yang_cost, max_pity').eq('item_id', sourceItemId).eq('variant', fromV),
    ])

    const matsByStep = {}
    for (const row of matRes.data ?? []) {
      if (!matsByStep[row.step]) matsByStep[row.step] = {}
      matsByStep[row.step][row.material_id] = row.quantity
    }
    const itemsByStep = {}
    for (const row of itemRes.data ?? []) {
      if (!itemsByStep[row.step]) itemsByStep[row.step] = {}
      itemsByStep[row.step][row.component_item_id] = row.quantity
    }
    const yangByStepLocal = {}
    const maxPityByStepLocal = {}
    for (const row of yangRes.data ?? []) {
      if (row.yang_cost) yangByStepLocal[row.step] = String(row.yang_cost)
      if (row.max_pity != null) maxPityByStepLocal[row.step] = String(row.max_pity)
    }

    // Replace only the target variant slot for every step, leaving other variants/steps untouched.
    if (toV === 1) {
      setStepMaterials(() => { const n = {}; for (let s = 0; s <= 9; s++) n[s] = matsByStep[s] ?? {}; return n })
      setStepItems(() => { const n = {}; for (let s = 0; s <= 9; s++) n[s] = itemsByStep[s] ?? {}; return n })
      setStepYang(() => { const n = {}; for (let s = 0; s <= 9; s++) n[s] = yangByStepLocal[s] ?? ''; return n })
      setStepMaxPity(() => { const n = {}; for (let s = 0; s <= 9; s++) n[s] = maxPityByStepLocal[s] ?? ''; return n })
    } else {
      setExtraVariantMaterials(prev => { const n = { ...prev }; for (let s = 0; s <= 9; s++) n[s] = { ...(n[s] ?? {}), [toV]: matsByStep[s] ?? {} }; return n })
      setExtraVariantItems(prev => { const n = { ...prev }; for (let s = 0; s <= 9; s++) n[s] = { ...(n[s] ?? {}), [toV]: itemsByStep[s] ?? {} }; return n })
      setExtraVariantYang(prev => { const n = { ...prev }; for (let s = 0; s <= 9; s++) n[s] = { ...(n[s] ?? {}), [toV]: yangByStepLocal[s] ?? '' }; return n })
      setExtraVariantMaxPity(prev => { const n = { ...prev }; for (let s = 0; s <= 9; s++) n[s] = { ...(n[s] ?? {}), [toV]: maxPityByStepLocal[s] ?? '' }; return n })
    }
    setStepVariantCount(prev => {
      const n = { ...prev }
      for (let s = 0; s <= 9; s++) n[s] = Math.max(n[s] ?? 1, toV)
      return n
    })

    setCopySearch('')
    setCopying(false)
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

    // Replace all item_materials (variant 1 + PVP extra variants)
    await supabase.from('item_materials').delete().eq('item_id', item.id)
    const matRows = []
    for (const [step, mats] of Object.entries(stepMaterials)) {
      for (const [material_id, quantity] of Object.entries(mats)) {
        if (Number(quantity) > 0) matRows.push({ item_id: item.id, material_id, quantity: Number(quantity), step: Number(step), variant: 1 })
      }
    }
    if (isPvpCategory) {
      for (const [step, byVariant] of Object.entries(extraVariantMaterials)) {
        for (const [variant, mats] of Object.entries(byVariant)) {
          for (const [material_id, quantity] of Object.entries(mats)) {
            if (Number(quantity) > 0) matRows.push({ item_id: item.id, material_id, quantity: Number(quantity), step: Number(step), variant: Number(variant) })
          }
        }
      }
    }
    if (matRows.length > 0) await supabase.from('item_materials').insert(matRows)

    // Replace all item_items (variant 1 + PVP extra variants)
    await supabase.from('item_items').delete().eq('item_id', item.id)
    const itemRows = []
    for (const [step, its] of Object.entries(stepItems)) {
      for (const [component_item_id, quantity] of Object.entries(its)) {
        if (Number(quantity) > 0) itemRows.push({ item_id: item.id, component_item_id, quantity: Number(quantity), step: Number(step), variant: 1 })
      }
    }
    if (isPvpCategory) {
      for (const [step, byVariant] of Object.entries(extraVariantItems)) {
        for (const [variant, its] of Object.entries(byVariant)) {
          for (const [component_item_id, quantity] of Object.entries(its)) {
            if (Number(quantity) > 0) itemRows.push({ item_id: item.id, component_item_id, quantity: Number(quantity), step: Number(step), variant: Number(variant) })
          }
        }
      }
    }
    if (itemRows.length > 0) await supabase.from('item_items').insert(itemRows)

    // Replace all yang costs / max pity (variant 1 + PVP extra variants)
    await supabase.from('item_step_yang').delete().eq('item_id', item.id)
    const yangRows = []
    const yangSteps = new Set([...Object.keys(stepYang), ...Object.keys(stepMaxPity)])
    for (const step of yangSteps) {
      const cost = parseYang(stepYang[step])
      const maxPity = parseInt(stepMaxPity[step], 10)
      if ((cost !== '' && cost > 0) || (!isNaN(maxPity) && maxPity >= 0)) {
        yangRows.push({
          item_id: item.id,
          step: Number(step),
          variant: 1,
          yang_cost: cost !== '' && cost > 0 ? cost : 0,
          max_pity: !isNaN(maxPity) && maxPity >= 0 ? maxPity : null,
        })
      }
    }
    if (isPvpCategory) {
      for (let step = 0; step <= 9; step++) {
        const count = getStepVariantCount(step)
        for (let variant = 2; variant <= count; variant++) {
          const cost = parseYang(extraVariantYang[step]?.[variant])
          const maxPity = parseInt(extraVariantMaxPity[step]?.[variant], 10)
          if ((cost !== '' && cost > 0) || (!isNaN(maxPity) && maxPity >= 0)) {
            yangRows.push({
              item_id: item.id,
              step,
              variant,
              yang_cost: cost !== '' && cost > 0 ? cost : 0,
              max_pity: !isNaN(maxPity) && maxPity >= 0 ? maxPity : null,
            })
          }
        }
      }
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

  const filteredMaterials = allMaterials.filter(m => !m.is_pvp_only && m.name.toLowerCase().includes(search.toLowerCase()))
  const filteredItems = allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  const currentStepMats = activeMats(activeStep)
  const currentStepItems = activeItms(activeStep)
  const activeVariant = getActiveVariant(activeStep)
  const activeVariantCount = getStepVariantCount(activeStep)

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
          <label className="text-sm text-gray-400">Copy recipe from existing item (optional)</label>
          {isPvpCategory && (
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-300 shrink-0">Copy variant</span>
              <input
                type="number"
                min="1"
                value={copyFromVariant}
                onChange={e => setCopyFromVariant(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-14 text-center text-xs focus:outline-none focus:border-yellow-400"
              />
              <span className="text-xs text-gray-300 shrink-0">from source into variant</span>
              <input
                type="number"
                min="1"
                value={copyToVariant}
                onChange={e => setCopyToVariant(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-14 text-center text-xs focus:outline-none focus:border-yellow-400"
              />
              <span className="text-xs text-gray-300 shrink-0">of this item</span>
            </div>
          )}
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
                  <span className="text-sm text-white flex-1">{formatItemName(it)}</span>
                  <span className="text-xs text-yellow-400 shrink-0">Copy</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Ingredients by step</label>
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

          {isPvpCategory && (
            <div className="flex items-center justify-between gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-300">Set variants for ALL steps (craft + all upgrades) at once</span>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="1"
                  value={bulkVariantCount}
                  onChange={e => setBulkVariantCount(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-16 text-center text-sm focus:outline-none focus:border-yellow-400"
                />
                <button
                  type="button"
                  onClick={() => setVariantCountForAllSteps(Math.max(1, parseInt(bulkVariantCount) || 1))}
                  className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-3 py-1 rounded-lg text-xs transition-colors"
                >
                  Apply to all steps
                </button>
              </div>
            </div>
          )}

          {isPvpCategory && (
            <div className="flex items-center justify-between gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-300">Number of craft/upgrade variants (this step only)</span>
              <input
                type="number"
                min="1"
                value={activeVariantCount}
                onChange={e => setVariantCountForStep(activeStep, Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-16 text-center text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
          )}

          {isPvpCategory && activeVariantCount > 1 && (
            <div className="flex items-center justify-center gap-4 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
              <button
                type="button"
                onClick={() => setActiveVariantForStep(activeStep, Math.max(1, activeVariant - 1))}
                disabled={activeVariant === 1}
                className="text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none px-1"
              >
                ‹
              </button>
              <span className="text-sm text-white font-semibold">Variant {activeVariant} / {activeVariantCount}</span>
              <button
                type="button"
                onClick={() => setActiveVariantForStep(activeStep, Math.min(activeVariantCount, activeVariant + 1))}
                disabled={activeVariant === activeVariantCount}
                className="text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none px-1"
              >
                ›
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
            <span className="text-yellow-400 text-sm font-semibold shrink-0">Yang cost</span>
            <input
              type="text"
              placeholder="e.g. 50kk"
              value={activeYang(activeStep)}
              onChange={e => setActiveYang(activeStep, e.target.value)}
              className="bg-transparent flex-1 text-white text-sm focus:outline-none text-right"
            />
            <span className="text-gray-400 text-sm shrink-0">yang</span>
          </div>

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
            <span className="text-yellow-400 text-sm font-semibold shrink-0">Max pity</span>
            <input
              type="number"
              min="0"
              placeholder="no limit"
              value={activeMaxPity(activeStep)}
              onChange={e => setActiveMaxPity(activeStep, e.target.value)}
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

          <input
            type="text"
            placeholder={pickerMode === 'materials' ? 'Search material...' : 'Search item...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          />

          {pickerMode === 'materials' ? (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
              {filteredMaterials.length === 0 && <p className="text-gray-500 text-sm p-2">No materials found.</p>}
              {filteredMaterials.map(mat => (
                <div key={mat.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={currentStepMats[mat.id] !== undefined}
                    onChange={() => toggleActiveMaterial(activeStep, mat.id)}
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
                      onChange={e => setActiveMaterialQty(activeStep, mat.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-700 border border-gray-500 rounded px-2 py-1 w-16 text-right text-sm focus:outline-none focus:border-yellow-400"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
              {filteredItems.length === 0 && <p className="text-gray-500 text-sm p-2">No items found.</p>}
              {filteredItems.map(it => (
                <div key={it.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                  <input
                    type="checkbox"
                    checked={currentStepItems[it.id] !== undefined}
                    onChange={() => toggleActiveItem(activeStep, it.id)}
                    className="accent-yellow-400"
                  />
                  {it.image_url
                    ? <img src={it.image_url} alt={it.name} className="w-7 h-7 object-contain" />
                    : <span className="w-7 text-center text-lg">⚔️</span>}
                  <span className="text-sm text-white flex-1">{formatItemName(it)}</span>
                  {currentStepItems[it.id] !== undefined && (
                    <input
                      type="number"
                      min="1"
                      value={currentStepItems[it.id]}
                      onChange={e => setActiveItemQty(activeStep, it.id, e.target.value)}
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
