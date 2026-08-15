import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'
import MaterialTile from '../components/MaterialTile'
import { formatYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import { formatItemName, PVP_CATEGORY_ID } from '../utils/itemName'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap,
  computeItemPrice, buildItemStepMap, buildItemYangMap, buildItemMaxPityMap, buildDefaultScrollMap,
  fetchGlobalPrices, makeMaterialPriceFn,
} from '../utils/priceBook'

const LIST_KEY = 'build_calculator_list'

function loadList() {
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY)) ?? []
  } catch {
    return []
  }
}

function saveList(ids) {
  localStorage.setItem(LIST_KEY, JSON.stringify(ids))
}

function loadItemChoices(itemId) {
  try {
    const raw = localStorage.getItem(`item_choices_${itemId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function BuildCalculator() {
  const { t } = useTranslation()
  const [allItems, setAllItems] = useState([])
  const [selectedIds, setSelectedIds] = useState(loadList)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [allItemMaterials, setAllItemMaterials] = useState({})
  const [allItemItems, setAllItemItems] = useState({})
  const [allItemYang, setAllItemYang] = useState({})
  const [allItemMaxPity, setAllItemMaxPity] = useState({})
  const [defaultScrollByStep, setDefaultScrollByStep] = useState({})
  const [globalPrices, setGlobalPrices] = useState({})
  const [materialsById, setMaterialsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const { rawInputs, mode, manualOverrides } = usePriceBook()

  useEffect(() => {
    Promise.all([
      db.from('items').select('id, name, image_url, image_urls, category_id').order('name'),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      db.from('materials').select('id, craft_yang_cost'),
      db.from('item_materials').select('item_id, material_id, quantity, step, variant'),
      db.from('item_items').select('item_id, component_item_id, quantity, step, variant'),
      db.from('item_step_yang').select('item_id, step, yang_cost, max_pity, variant'),
      db.from('materials').select('id, name, image_url').eq('is_upgrade_scroll', true).order('name'),
      db.from('materials').select('id, name, image_url, is_craftable'),
      fetchGlobalPrices(),
    ]).then(([itemsRes, recipeRes, allMatsRes, allItemMatsRes, allItemItemsRes, allItemYangRes, scrollsRes, allMaterialsRes, globalPricesMap]) => {
      setAllItems(itemsRes.data ?? [])
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(allMatsRes.data))
      setAllItemMaterials(buildItemStepMap(allItemMatsRes.data))
      setAllItemItems(buildItemStepMap(allItemItemsRes.data))
      setAllItemYang(buildItemYangMap(allItemYangRes.data))
      setAllItemMaxPity(buildItemMaxPityMap(allItemYangRes.data))
      setDefaultScrollByStep(buildDefaultScrollMap(scrollsRes.data))
      const byId = {}
      for (const m of allMaterialsRes.data ?? []) byId[m.id] = m
      setMaterialsById(byId)
      setGlobalPrices(globalPricesMap)
      setLoading(false)
    })
  }, [])

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts, manualOverrides })

  const ctx = {
    materialPriceFn: priceFn,
    itemMaterials: allItemMaterials,
    itemItems: allItemItems,
    itemYang: allItemYang,
    itemMaxPity: allItemMaxPity,
    defaultScrollByStep,
  }

  const selectedItems = selectedIds.map(id => allItems.find(i => i.id === id)).filter(Boolean)
  const grandTotal = selectedItems.reduce((s, it) => s + computeItemPrice(it.id, ctx), 0)

  // Mirrors computeItemPrice's per-item step/choice logic, but collects the raw
  // ingredient rows instead of summing straight to a price — so the popup can show
  // "what to gather" across every selected item at once.
  function buildMaterialsSummary() {
    const map = new Map()

    function addRow(material, kind, qty) {
      const key = `${kind}-${material.id}`
      const existing = map.get(key)
      if (existing) existing.quantity += qty
      else map.set(key, { material: kind === 'item' ? { ...material, name: formatItemName(material) } : material, kind, quantity: qty })
    }

    for (const item of selectedItems) {
      const choices = loadItemChoices(item.id)
      const includeCraft = choices?.includeCraft ?? true
      const matSteps = allItemMaterials[item.id] ?? {}
      const itemSteps = allItemItems[item.id] ?? {}
      const yangSteps = allItemYang[item.id] ?? {}
      const maxPityMap = allItemMaxPity[item.id] ?? {}

      const steps = new Set([
        ...Object.keys(matSteps).map(Number),
        ...Object.keys(itemSteps).map(Number),
        ...Object.keys(yangSteps).map(Number),
      ])

      for (const step of steps) {
        if (step === 0 && !includeCraft) continue

        const variant = choices?.variantByStep?.[step] ?? 1

        let pity = choices ? Math.max(0, parseInt(choices.pity?.[step]) || 0) : 0
        const maxPity = maxPityMap[step]?.[variant]
        if (maxPity != null) pity = Math.min(pity, maxPity)
        pity += 1

        for (const row of (matSteps[step] ?? []).filter(r => (r.variant ?? 1) === variant)) {
          const mat = materialsById[row.material_id]
          if (mat) addRow(mat, 'material', row.quantity * pity)
        }
        for (const row of (itemSteps[step] ?? []).filter(r => (r.variant ?? 1) === variant)) {
          const comp = allItems.find(i => i.id === row.component_item_id)
          if (comp) addRow(comp, 'item', row.quantity * pity)
        }

        if (step !== 0) {
          const scrollId = choices ? (choices.selectedScroll?.[step] ?? '') : defaultScrollByStep[step]
          const scrollMat = scrollId ? materialsById[scrollId] : null
          if (scrollMat) addRow(scrollMat, 'material', pity)

          for (const sealId of choices?.selectedSeals?.[step] ?? []) {
            const sealMat = materialsById[sealId]
            if (sealMat) addRow(sealMat, 'material', pity)
          }
        }
      }
    }

    const rows = [...map.values()].sort((a, b) => a.material.name.localeCompare(b.material.name))
    return { rows }
  }

  function addItem(id) {
    if (selectedIds.includes(id)) return
    const next = [...selectedIds, id]
    setSelectedIds(next)
    saveList(next)
    setSearch('')
  }

  function removeItem(id) {
    const next = selectedIds.filter(x => x !== id)
    setSelectedIds(next)
    saveList(next)
  }

  function getItemSteps(itemId) {
    const matSteps = allItemMaterials[itemId] ?? {}
    const itemSteps = allItemItems[itemId] ?? {}
    const yangSteps = allItemYang[itemId] ?? {}
    return new Set([
      ...Object.keys(matSteps).map(Number),
      ...Object.keys(itemSteps).map(Number),
      ...Object.keys(yangSteps).map(Number),
    ])
  }

  function maxVariantCountForItem(itemId) {
    const matSteps = allItemMaterials[itemId] ?? {}
    const itemSteps = allItemItems[itemId] ?? {}
    const yangSteps = allItemYang[itemId] ?? {}
    let max = 1
    for (const rows of Object.values(matSteps)) for (const r of rows) max = Math.max(max, r.variant ?? 1)
    for (const rows of Object.values(itemSteps)) for (const r of rows) max = Math.max(max, r.variant ?? 1)
    for (const variants of Object.values(yangSteps)) for (const v of Object.keys(variants)) max = Math.max(max, Number(v))
    return max
  }

  function getItemVariant(itemId) {
    return loadItemChoices(itemId)?.variantByStep?.[0] ?? 1
  }

  function cycleItemVariant(itemId) {
    const maxCount = maxVariantCountForItem(itemId)
    const next = getItemVariant(itemId) >= maxCount ? 1 : getItemVariant(itemId) + 1
    const choices = loadItemChoices(itemId) ?? { selectedScroll: {}, selectedSeals: {}, pity: {}, includeCraft: true, variantByStep: {} }
    const nextVariantByStep = {}
    for (const step of getItemSteps(itemId)) nextVariantByStep[step] = next
    choices.variantByStep = nextVariantByStep
    localStorage.setItem(`item_choices_${itemId}`, JSON.stringify(choices))
    setRefreshTick(t => t + 1)
  }

  function resetPityToZero() {
    for (const id of selectedIds) {
      const choices = loadItemChoices(id) ?? { selectedScroll: {}, selectedSeals: {}, pity: {}, includeCraft: true }
      const nextPity = {}
      for (let s = 0; s <= 9; s++) nextPity[s] = 0
      choices.pity = nextPity
      localStorage.setItem(`item_choices_${id}`, JSON.stringify(choices))
    }
    setRefreshTick(t => t + 1)
  }

  function setPityToMax() {
    for (const id of selectedIds) {
      const choices = loadItemChoices(id) ?? { selectedScroll: {}, selectedSeals: {}, pity: {}, includeCraft: true }
      const maxMap = allItemMaxPity[id] ?? {}
      const nextPity = { ...choices.pity }
      for (let s = 0; s <= 9; s++) {
        const variant = choices.variantByStep?.[s] ?? 1
        const max = maxMap[s]?.[variant]
        if (max != null) nextPity[s] = max
      }
      choices.pity = nextPity
      localStorage.setItem(`item_choices_${id}`, JSON.stringify(choices))
    }
    setRefreshTick(t => t + 1)
  }

  const filtered = searchFocused || search.trim().length > 0
    ? allItems.filter(i => !selectedIds.includes(i.id) && i.name.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('buildCalculator.title') }]} />
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-100">{t('buildCalculator.title')}</h1>
          {mode === 'global' && (
            <span className="text-xs bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-1 rounded-full">
              {t('materials.globalPrices')}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 mb-4 relative">
          <input
            type="text"
            placeholder={t('buildCalculator.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          />
          {filtered.length > 0 && (
            <div className="flex flex-col gap-1 bg-gray-800 border border-gray-700 rounded-lg p-2 max-h-48 overflow-y-auto">
              {filtered.map(it => (
                <button
                  key={it.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => addItem(it.id)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 text-left"
                >
                  {itemImages(it).length > 0
                    ? <img src={itemImages(it)[0]} alt={it.name} className="w-7 h-7 object-contain" />
                    : <span className="w-7 text-center text-lg">⚔️</span>}
                  <span className="text-sm text-white flex-1">{formatItemName(it)}</span>
                  <span className="text-xs text-yellow-400 shrink-0">{t('buildCalculator.addItem')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={resetPityToZero}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {t('buildCalculator.resetPityAll')}
            </button>
            <button
              type="button"
              onClick={setPityToMax}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {t('buildCalculator.setPityMaxAll')}
            </button>
          </div>
        )}

        {loading ? <Spinner /> : selectedItems.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">🛡️</span>
            <p className="text-sm">{t('buildCalculator.noItemsYet')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {selectedItems.map(item => {
                const price = computeItemPrice(item.id, ctx)
                const maxVariantCount = maxVariantCountForItem(item.id)
                const showVariantButton = item.category_id === PVP_CATEGORY_ID && maxVariantCount > 1
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-700">
                    <Link to={`/chapter/${item.category_id}/item/${item.id}`} className="w-8 h-8 shrink-0 flex items-center justify-center hover:opacity-75 transition-opacity">
                      {itemImages(item).length > 0
                        ? <img src={itemImages(item)[0]} alt={item.name} className="w-full h-full object-contain" />
                        : <span className="text-lg">⚔️</span>}
                    </Link>
                    <Link to={`/chapter/${item.category_id}/item/${item.id}`} className="flex-1 text-sm text-gray-200 hover:text-yellow-400 transition-colors truncate">
                      {formatItemName(item)}
                    </Link>
                    {showVariantButton && (
                      <button
                        type="button"
                        onClick={() => cycleItemVariant(item.id)}
                        className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 hover:text-yellow-200 text-xs font-semibold px-2 py-1 rounded-lg transition-colors shrink-0"
                      >
                        {t('itemDetail.variant', { current: getItemVariant(item.id), count: maxVariantCount })}
                      </button>
                    )}
                    <span className="text-yellow-400 text-sm font-mono shrink-0">{formatYang(price)}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                      title={t('buildCalculator.removeTooltip')}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 hover:text-yellow-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {t('itemDetail.materialsSummary')}
            </button>

            <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-semibold">{t('buildCalculator.grandTotal')}</span>
                <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(grandTotal)}</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {showSummary && (() => {
        const { rows } = buildMaterialsSummary()
        return (
          <Modal title={t('itemDetail.materialsSummaryTitle')} onClose={() => setShowSummary(false)}>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">{t('itemDetail.noMaterialsDefined')}</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {rows.map(row => (
                  <MaterialTile key={`${row.kind}-${row.material.id}`} mat={row.material} quantity={row.quantity} kind={row.kind} />
                ))}
              </div>
            )}
          </Modal>
        )
      })()}
    </div>
  )
}
