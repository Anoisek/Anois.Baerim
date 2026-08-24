import { useEffect, useState } from 'react'
import { db } from '../dbClient'
import { parseYang } from '../utils/formatYang'
import { CATEGORY_TAGS } from '../utils/materialCategoryTags'
import Modal from './Modal'
import ImageUpload from './ImageUpload'
import IconDbPicker from './IconDbPicker'

export default function AddMaterialModal({ onClose, onAdded }) {
  const [name, setName] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [tag, setTag] = useState('')
  const [categoryTag, setCategoryTag] = useState('')
  const [isCraftable, setIsCraftable] = useState(false)
  const [isPvp, setIsPvp] = useState(false)
  const [isPvpOnly, setIsPvpOnly] = useState(false)
  const [noPrice, setNoPrice] = useState(false)
  const [craftYangCost, setCraftYangCost] = useState('')
  const [allMaterials, setAllMaterials] = useState([])
  const [components, setComponents] = useState({}) // variant 1: { materialId: qty }
  const [variantComponents, setVariantComponents] = useState({}) // variants 2+: { variant: { materialId: qty } }
  const [variantCount, setVariantCount] = useState(1)
  const [activeVariant, setActiveVariant] = useState(1)
  const [variantYield, setVariantYield] = useState({}) // { variant: string }
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    db.from('materials').select('*').order('name').then(({ data }) => {
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

  function toggleActiveComponent(materialId) {
    if (activeVariant === 1) { toggleComponent(materialId); return }
    setVariantComponents(prev => {
      const cur = { ...(prev[activeVariant] ?? {}) }
      if (cur[materialId] !== undefined) delete cur[materialId]
      else cur[materialId] = 1
      return { ...prev, [activeVariant]: cur }
    })
  }

  function setActiveQty(materialId, val) {
    if (activeVariant === 1) { setQty(materialId, val); return }
    setVariantComponents(prev => ({
      ...prev,
      [activeVariant]: { ...(prev[activeVariant] ?? {}), [materialId]: val },
    }))
  }

  const activeComponents = activeVariant === 1 ? components : (variantComponents[activeVariant] ?? {})

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await db
      .from('materials')
      .insert({
        name: name.trim(),
        image_urls: imageUrls,
        image_url: imageUrls[0] ?? null,
        is_upgrade_scroll: tag === 'scroll',
        is_seal: tag === 'seal',
        is_item: tag === 'item',
        category_tag: categoryTag || null,
        is_craftable: isCraftable,
        craft_yang_cost: isCraftable && !isPvp ? (parseYang(craftYangCost) || null) : null,
        is_pvp: isPvp,
        is_pvp_only: isPvpOnly,
        no_price: noPrice,
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
        .map(([component_id, quantity]) => ({ material_id: data.id, component_id, quantity: Number(quantity), variant: 1 }))

      if (isPvp) {
        for (let v = 2; v <= variantCount; v++) {
          for (const [component_id, qty] of Object.entries(variantComponents[v] ?? {})) {
            if (Number(qty) > 0) rows.push({ material_id: data.id, component_id, quantity: Number(qty), variant: v })
          }
        }
      }

      if (rows.length > 0) {
        const { error: err } = await db.from('material_materials').insert(rows)
        if (err) { alert('Error saving recipe: ' + err.message); setSaving(false); return }
      }

      if (isPvp) {
        const yieldRows = []
        for (let v = 1; v <= variantCount; v++) {
          const y = Math.max(1, parseInt(variantYield[v]) || 1)
          yieldRows.push({ material_id: data.id, variant: v, yield: y })
        }
        await db.from('material_craft_variant_yield').insert(yieldRows)
      }
    }

    onAdded(data)
    onClose()
    setSaving(false)
  }

  const filtered = allMaterials.filter(m => (isPvp || !m.is_pvp_only) && m.name.toLowerCase().includes(search.toLowerCase()))

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
          <div className="flex flex-wrap gap-2">
            <ImageUpload onUploaded={url => setImageUrls(prev => [...prev, url])} />
            <IconDbPicker onUploaded={url => setImageUrls(prev => [...prev, url])} />
          </div>
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

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Category (sorting only, not shown on the tile)</label>
          <select
            value={categoryTag}
            onChange={e => setCategoryTag(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          >
            <option value="">No category</option>
            {CATEGORY_TAGS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
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

        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={isPvp}
            onChange={e => setIsPvp(e.target.checked)}
            className="accent-red-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">PVP only (shown only in the PVP materials tab)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={isPvpOnly}
            onChange={e => setIsPvpOnly(e.target.checked)}
            className="accent-red-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">PVP-only ingredient (hidden from item recipes — only pickable when crafting other PVP materials)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            checked={noPrice}
            onChange={e => setNoPrice(e.target.checked)}
            className="accent-gray-400 w-4 h-4"
          />
          <span className="text-sm text-gray-200">No price (always free — price cannot be entered or submitted)</span>
        </label>

        {isCraftable && (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400">Crafted from</label>

            {!isPvp && (
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
            )}

            {isPvp && (
              <div className="flex items-center justify-between gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-300">Number of craft variants</span>
                <input
                  type="number"
                  min="1"
                  value={variantCount}
                  onChange={e => {
                    const n = Math.max(1, parseInt(e.target.value) || 1)
                    setVariantCount(n)
                    setActiveVariant(v => Math.min(v, n))
                  }}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-16 text-center text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {isPvp && variantCount > 1 && (
              <div className="flex items-center justify-center gap-4 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
                <button
                  type="button"
                  onClick={() => setActiveVariant(v => Math.max(1, v - 1))}
                  disabled={activeVariant === 1}
                  className="text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none px-1"
                >
                  ‹
                </button>
                <span className="text-sm text-white font-semibold">Variant {activeVariant} / {variantCount}</span>
                <button
                  type="button"
                  onClick={() => setActiveVariant(v => Math.min(variantCount, v + 1))}
                  disabled={activeVariant === variantCount}
                  className="text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none px-1"
                >
                  ›
                </button>
              </div>
            )}

            {isPvp && (
              <div className="flex items-center justify-between gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-300">Produces (yield of this variant)</span>
                <input
                  type="number"
                  min="1"
                  value={variantYield[activeVariant] ?? '1'}
                  onChange={e => setVariantYield(prev => ({ ...prev, [activeVariant]: e.target.value }))}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-16 text-center text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

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
                    checked={activeComponents[mat.id] !== undefined}
                    onChange={() => toggleActiveComponent(mat.id)}
                    className="accent-yellow-400"
                  />
                  {mat.image_url
                    ? <img src={mat.image_url} alt={mat.name} className="w-7 h-7 object-contain" />
                    : <span className="w-7 text-center text-lg">🧪</span>}
                  <span className="text-sm text-white flex-1">{mat.name}</span>
                  {activeComponents[mat.id] !== undefined && (
                    <input
                      type="number"
                      min="1"
                      value={activeComponents[mat.id]}
                      onChange={e => setActiveQty(mat.id, e.target.value)}
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
