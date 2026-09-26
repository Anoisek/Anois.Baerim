import { Fragment, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import SealPicker from '../components/SealPicker'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'
import { formatYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import ItemImage from '../components/ItemImage'
import MaterialTile from '../components/MaterialTile'
import CraftOverviewPanel from '../components/CraftOverviewPanel'
import PriceModeToggle from '../components/PriceModeToggle'
import MaterialPriceCell from '../components/MaterialPriceCell'
import { formatItemName, PVP_CATEGORY_ID, ENIGMA_POTION_ID, NO_DEFAULT_SCROLL_ITEM_IDS } from '../utils/itemName'
import { scrollsForItem, sealsForItem, defaultScrollsForItem, sanitizeScrollChoices, sanitizeSealChoices, unlockersForItem, selectedUnlockers } from '../utils/itemUpgradeRules'
import UnlockerPicker from '../components/UnlockerPicker'
import { slugify, findBySlugOrId } from '../utils/slug'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap,
  computeItemPrice, buildItemStepMap, buildItemYangMap, buildItemMaxPityMap, buildDefaultScrollMap,
  fetchGlobalPrices, makeMaterialPriceFn, FIXED_MATERIAL_PRICES,
} from '../utils/priceBook'
import { EmptyState, MatTag, PityStepper, ScrollPicker } from './ui'

const STEP_LABEL_KEYS = {
  0: 'itemDetail.step0', 1: 'itemDetail.step1', 2: 'itemDetail.step2', 3: 'itemDetail.step3',
  4: 'itemDetail.step4', 5: 'itemDetail.step5', 6: 'itemDetail.step6',
  7: 'itemDetail.step7', 8: 'itemDetail.step8', 9: 'itemDetail.step9',
}

const SCROLL_ORDER = [
  'Blessing Scroll', 'Dragon Scroll', 'Scroll of Honor',
  'Blacksmith Handbook', 'Scroll of War', 'Magic Stone',
]

function excludedStepsForOwnedLevel(level) {
  if (level === '-') return {}
  const excluded = {}
  for (let s = 0; s <= Number(level); s++) excluded[s] = true
  return excluded
}

export default function ItemDetailH() {
  const { t } = useTranslation()
  const { categoryId, itemId: itemParam } = useParams()
  const [itemId, setItemId] = useState(null)
  const [item, setItem] = useState(null)
  const [groupedByVariant, setGroupedByVariant] = useState({})
  const [yangByVariant, setYangByVariant] = useState({})
  const [maxPityByVariant, setMaxPityByVariant] = useState({})
  const [selectedVariant, setSelectedVariant] = useState({})
  const [scrolls, setScrolls] = useState([])
  const [seals, setSeals] = useState([])
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [noPriceIds, setNoPriceIds] = useState(new Set())
  const [allItemMaterials, setAllItemMaterials] = useState({})
  const [allItemItems, setAllItemItems] = useState({})
  const [allItemYang, setAllItemYang] = useState({})
  const [allItemMaxPity, setAllItemMaxPity] = useState({})
  const [defaultScrollByStep, setDefaultScrollByStep] = useState({})
  const [selectedScroll, setSelectedScroll] = useState({})
  const [selectedSeals, setSelectedSeals] = useState({})
  const [unlockerMats, setUnlockerMats] = useState([])
  const [chosenUnlockers, setChosenUnlockers] = useState([])
  const [pity, setPity] = useState({})
  const [ownedLevel, setOwnedLevel] = useState('-')
  const [manualExcludedSteps, setManualExcludedSteps] = useState({})
  const [showSummary, setShowSummary] = useState(false)
  const [showPriceAdjust, setShowPriceAdjust] = useState(false)
  const [globalPrices, setGlobalPrices] = useState({})
  const [chapterName, setChapterName] = useState(null)
  const [categoryName, setCategoryName] = useState(null)
  const [siblingItems, setSiblingItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { rawInputs, setPrice, mode, setMode, manualOverrides, toggleManualOverride } = usePriceBook()

  useEffect(() => {
    let cancelled = false
    setItemId(null)
    Promise.all([
      db.from('categories').select('id, name'),
      db.from('items').select('id, name, category_id'),
    ]).then(([catsRes, itemsRes]) => {
      if (cancelled) return
      const category = findBySlugOrId(catsRes.data ?? [], categoryId)
      const allItems = itemsRes.data ?? []
      const scoped = category ? allItems.filter(i => i.category_id === category.id) : allItems
      const resolved = findBySlugOrId(scoped.length > 0 ? scoped : allItems, itemParam)
      if (!resolved) setLoading(false)
      setItemId(resolved?.id ?? null)
    })
    return () => { cancelled = true }
  }, [categoryId, itemParam])

  useEffect(() => {
    if (!itemId) return
    Promise.all([
      db.from('items').select('*').eq('id', itemId).single(),
      db.from('item_materials').select('quantity, step, variant, material_id').eq('item_id', itemId).order('step'),
      db.from('item_items').select('quantity, step, variant, component_item_id').eq('item_id', itemId).order('step'),
      db.from('item_step_yang').select('step, variant, yang_cost, max_pity').eq('item_id', itemId),
      db.from('materials').select('id, name, image_url, is_craftable, no_price').eq('is_upgrade_scroll', true).order('name'),
      db.from('materials').select('id, name, image_url, is_craftable, no_price').eq('is_seal', true).order('name'),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      db.from('materials').select('id, name, image_url, is_craftable, craft_yang_cost, no_price'),
      db.from('items').select('id, name, image_url, category_id'),
      db.from('item_materials').select('item_id, material_id, quantity, step, variant'),
      db.from('item_items').select('item_id, component_item_id, quantity, step, variant'),
      db.from('item_step_yang').select('item_id, step, yang_cost, max_pity, variant'),
      fetchGlobalPrices(),
    ]).then(([itemRes, matsRes, itemIngRes, yangRes, scrollsRes, sealsRes, recipeRes, allMatsRes, allItemsRes, allItemMatsRes, allItemItemsRes, allItemYangRes, globalPricesMap]) => {
      setItem(itemRes.data)

      const materialsById = Object.fromEntries((allMatsRes.data ?? []).map(m => [m.id, m]))
      const itemsById = Object.fromEntries((allItemsRes.data ?? []).map(i => [i.id, i]))

      const g = {}
      for (const row of matsRes.data ?? []) {
        const v = row.variant ?? 1
        if (!g[row.step]) g[row.step] = {}
        if (!g[row.step][v]) g[row.step][v] = []
        g[row.step][v].push({ material: materialsById[row.material_id], quantity: row.quantity, kind: 'material' })
      }
      for (const row of itemIngRes.data ?? []) {
        const v = row.variant ?? 1
        if (!g[row.step]) g[row.step] = {}
        if (!g[row.step][v]) g[row.step][v] = []
        g[row.step][v].push({ material: itemsById[row.component_item_id], quantity: row.quantity, kind: 'item' })
      }
      setGroupedByVariant(g)

      const yc = {}
      const mp = {}
      for (const row of yangRes.data ?? []) {
        const v = row.variant ?? 1
        if (!yc[row.step]) yc[row.step] = {}
        yc[row.step][v] = row.yang_cost
        const maxPity = row.max_pity ?? (row.step === 0 ? 0 : null)
        if (maxPity != null) {
          if (!mp[row.step]) mp[row.step] = {}
          mp[row.step][v] = maxPity
        }
      }
      setYangByVariant(yc)
      setMaxPityByVariant(mp)

      const allScrolls = (scrollsRes.data ?? []).sort((a, b) => {
        const ai = SCROLL_ORDER.findIndex(n => a.name.toLowerCase().includes(n.toLowerCase()))
        const bi = SCROLL_ORDER.findIndex(n => b.name.toLowerCase().includes(n.toLowerCase()))
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      const sorted = scrollsForItem(itemId, allScrolls)
      const globalDefaultScrolls = buildDefaultScrollMap(scrollsForItem(null, allScrolls))
      setScrolls(sorted)
      setSeals(sealsForItem(itemId, sealsRes.data ?? []))
      setUnlockerMats(unlockersForItem(itemId).map(id => materialsById[id]).filter(Boolean))
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(allMatsRes.data))
      setAllItemMaterials(buildItemStepMap(allItemMatsRes.data))
      setAllItemItems(buildItemStepMap(allItemItemsRes.data))
      setAllItemYang(buildItemYangMap(allItemYangRes.data))
      setAllItemMaxPity(buildItemMaxPityMap(allItemYangRes.data))
      setDefaultScrollByStep(globalDefaultScrolls)
      setGlobalPrices(globalPricesMap)
      setNoPriceIds(new Set((allMatsRes.data ?? []).filter(m => m.no_price).map(m => m.id)))

      setOwnedLevel('-')
      setManualExcludedSteps({})

      const saved = localStorage.getItem(`item_choices_${itemId}`)
      const savedChoices = saved ? JSON.parse(saved) : null

      if (savedChoices) {
        setSelectedScroll(NO_DEFAULT_SCROLL_ITEM_IDS.has(itemId) ? {} : sanitizeScrollChoices(itemId, savedChoices.selectedScroll, globalDefaultScrolls))
        setSelectedSeals(sanitizeSealChoices(itemId, savedChoices.selectedSeals))
        setChosenUnlockers(selectedUnlockers(itemId, savedChoices.unlockers))
        setPity(savedChoices.pity ?? {})
        setOwnedLevel(savedChoices.ownedLevel ?? (savedChoices.includeCraft === false ? '0' : '-'))
        setSelectedVariant(savedChoices.variantByStep ?? {})
      } else {
        setSelectedVariant({})
        setChosenUnlockers([])
        if (!NO_DEFAULT_SCROLL_ITEM_IDS.has(itemId)) {
          const defaults = defaultScrollsForItem(itemId, globalDefaultScrolls)
          if (Object.values(defaults).some(Boolean)) {
            setSelectedScroll(Object.fromEntries(Object.entries(defaults).map(([step, id]) => [step, id ?? ''])))
          }
        }
      }

      setLoading(false)
    })
  }, [itemId])

  useEffect(() => {
    if (!item) return
    let siblingsQuery = db.from('items').select('id, name, image_url, image_urls, category_id').eq('category_id', item.category_id).order('sort_order')
    siblingsQuery = item.subcategory_id ? siblingsQuery.eq('subcategory_id', item.subcategory_id) : siblingsQuery.is('subcategory_id', null)

    Promise.all([
      db.from('categories').select('name').eq('id', item.category_id).single(),
      item.subcategory_id ? db.from('subcategories').select('name').eq('id', item.subcategory_id).single() : Promise.resolve({ data: null }),
      siblingsQuery,
    ]).then(([catRes, subRes, siblingsRes]) => {
      setChapterName(catRes.data?.name ?? null)
      setCategoryName(subRes.data?.name ?? null)
      setSiblingItems(siblingsRes.data ?? [])
    })
  }, [item])

  useEffect(() => {
    if (loading) return
    const includeCraft = ownedLevel === '-'
    const excludedSteps = excludedStepsForOwnedLevel(ownedLevel)
    localStorage.setItem(`item_choices_${itemId}`, JSON.stringify({ selectedScroll, selectedSeals, pity, includeCraft, excludedSteps, ownedLevel, variantByStep: selectedVariant, unlockers: chosenUnlockers }))
  }, [itemId, loading, selectedScroll, selectedSeals, pity, ownedLevel, selectedVariant, chosenUnlockers])

  function clearAllScrolls() {
    setSelectedScroll(prev => {
      const next = { ...prev }
      for (let s = 1; s <= 9; s++) next[s] = ''
      return next
    })
  }
  function resetAllPity() {
    setPity(prev => {
      const next = { ...prev }
      for (let s = 0; s <= 9; s++) next[s] = 0
      return next
    })
  }
  function setAllPityToMax() {
    setPity(prev => {
      const next = { ...prev }
      for (let s = 0; s <= 9; s++) {
        if (maxPityByStep[s] != null) next[s] = maxPityByStep[s]
      }
      return next
    })
  }

  function toggleStepIncluded(step) {
    const ownedExcluded = excludedStepsForOwnedLevel(ownedLevel)
    const reachableSteps = allSteps.filter(s => !ownedExcluded[s])
    setManualExcludedSteps(prev => {
      const next = { ...prev }
      if (prev[step]) {
        for (const s of reachableSteps) if (s <= step) next[s] = false
      } else {
        for (const s of reachableSteps) if (s >= step) next[s] = true
      }
      return next
    })
  }

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts, manualOverrides, noPriceIds })
  function priceOf(materialId) { return priceFn(materialId) }

  const isPvpItem = item?.category_id === PVP_CATEGORY_ID
  const isRangedUpgradeItem = itemId === ENIGMA_POTION_ID

  const siblingIndex = siblingItems.findIndex(i => i.id === itemId)
  const prevItem = siblingIndex > 0 ? siblingItems[siblingIndex - 1] : null
  const nextItem = siblingIndex >= 0 && siblingIndex < siblingItems.length - 1 ? siblingItems[siblingIndex + 1] : null

  function variantCountForStep(step) {
    const fromGroups = Object.keys(groupedByVariant[step] ?? {}).map(Number)
    const fromYang = Object.keys(yangByVariant[step] ?? {}).map(Number)
    const all = [...fromGroups, ...fromYang]
    return all.length > 0 ? Math.max(...all) : 1
  }
  function getStepVariant(step) { return isPvpItem ? (selectedVariant[step] ?? 1) : 1 }

  const grouped = {}
  const yangCosts = {}
  const maxPityByStep = {}
  for (const step of new Set([...Object.keys(groupedByVariant).map(Number), ...Object.keys(yangByVariant).map(Number)])) {
    const v = getStepVariant(step)
    grouped[step] = groupedByVariant[step]?.[v] ?? []
    yangCosts[step] = yangByVariant[step]?.[v] ?? 0
    if (maxPityByVariant[step]?.[v] != null) maxPityByStep[step] = maxPityByVariant[step][v]
  }

  function itemIngredientCtx() {
    return {
      materialPriceFn: priceFn, itemMaterials: allItemMaterials, itemItems: allItemItems,
      itemYang: allItemYang, itemMaxPity: allItemMaxPity, defaultScrollByStep, manualOverrides, rawInputs,
    }
  }
  function rowPrice(row) { return row.kind === 'item' ? computeItemPrice(row.material.id, itemIngredientCtx()) : priceOf(row.material.id) }

  function getPityInput(step) {
    const val = Math.max(0, parseInt(pity[step]) || 0)
    const max = maxPityByStep[step]
    return max != null ? Math.min(val, max) : val
  }
  function getPity(step) { return getPityInput(step) + 1 }
  function matCost(rows) { return rows.reduce((s, r) => s + rowPrice(r) * r.quantity, 0) }
  function scrollCost(step) { const id = selectedScroll[step]; return id ? priceOf(id) : 0 }
  function sealsCost(step) { return (selectedSeals[step] ?? []).reduce((s, id) => s + priceOf(id), 0) }
  function stepTotal(step) { return (matCost(grouped[step] ?? []) + (yangCosts[step] ?? 0) + scrollCost(step) + sealsCost(step)) * getPity(step) }

  const allSteps = [...new Set([...Object.keys(grouped).map(Number), ...Object.keys(yangCosts).map(Number)])].sort((a, b) => a - b)
  const maxVariantCount = allSteps.length > 0 ? Math.max(1, ...allSteps.map(variantCountForStep)) : 1
  const currentGlobalVariant = allSteps.length > 0 ? getStepVariant(allSteps[0]) : 1

  function cycleGlobalVariant() {
    const next = currentGlobalVariant >= maxVariantCount ? 1 : currentGlobalVariant + 1
    setSelectedVariant(() => {
      const next2 = {}
      for (const step of allSteps) next2[step] = next
      return next2
    })
  }

  const excludedSteps = { ...excludedStepsForOwnedLevel(ownedLevel), ...manualExcludedSteps }
  function isStepIncluded(step) { return !excludedSteps[step] }
  // One-time unlockers (checked above the step list) count once, outside any step/pity.
  const unlockersTotal = chosenUnlockers.reduce((s, id) => s + priceOf(id), 0)
  const total = allSteps.reduce((s, step) => isStepIncluded(step) ? s + stepTotal(step) : s, 0) + unlockersTotal

  function toggleUnlocker(id) {
    setChosenUnlockers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function buildMaterialsSummary() {
    const map = new Map()
    function addRow(material, kind, qty) {
      const key = `${kind}-${material.id}`
      const existing = map.get(key)
      if (existing) existing.quantity += qty
      else map.set(key, { material: kind === 'item' ? { ...material, name: formatItemName(material) } : material, kind, quantity: qty })
    }
    for (const step of allSteps) {
      if (!isStepIncluded(step)) continue
      const p = getPity(step)
      for (const row of grouped[step] ?? []) addRow(row.material, row.kind, row.quantity * p)
      const scrollId = selectedScroll[step]
      const scrollMat = scrollId ? scrolls.find(s => s.id === scrollId) : null
      if (scrollMat) addRow(scrollMat, 'material', p)
      for (const sealId of selectedSeals[step] ?? []) {
        const sealMat = seals.find(s => s.id === sealId)
        if (sealMat) addRow(sealMat, 'material', p)
      }
    }
    for (const id of chosenUnlockers) {
      const mat = unlockerMats.find(m => m.id === id)
      if (mat) addRow(mat, 'material', 1)
    }
    const rows = [...map.values()].sort((a, b) => a.material.name.localeCompare(b.material.name))
    return { rows }
  }

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        {loading ? (
          <div className="py-20 flex justify-center"><Spinner /></div>
        ) : !item ? (
          <EmptyState emoji="📭" text={t('itemDetail.notFound')} />
        ) : (
          <>
            <Breadcrumbs items={[
              { label: t('common.home'), to: '/' },
              { label: chapterName ?? t('common.chapter'), to: `/chapter/${categoryId}` },
              ...(item.subcategory_id
                ? [{ label: categoryName ?? t('common.category'), to: `/chapter/${categoryId}/sub/${slugify(categoryName ?? '')}` }]
                : []),
              { label: formatItemName(item) },
            ]} />

            {(prevItem || nextItem) && (
              <div className="flex items-center justify-between gap-3 my-3">
                {prevItem ? (
                  <Link to={`/chapter/${categoryId}/item/${slugify(prevItem.name)}`} className="flex items-center gap-1.5 min-w-0 text-xs text-gray-400 hover:text-yellow-400 transition-colors" title={formatItemName(prevItem)}>
                    <span className="text-base leading-none shrink-0">‹</span><span className="truncate">{formatItemName(prevItem)}</span>
                  </Link>
                ) : <span />}
                {nextItem && (
                  <Link to={`/chapter/${categoryId}/item/${slugify(nextItem.name)}`} className="flex items-center gap-1.5 min-w-0 text-xs text-gray-400 hover:text-yellow-400 transition-colors text-right" title={formatItemName(nextItem)}>
                    <span className="truncate">{formatItemName(nextItem)}</span><span className="text-base leading-none shrink-0">›</span>
                  </Link>
                )}
              </div>
            )}

            {/* Item header band */}
            <div className="flex items-center gap-5 my-4 px-5 py-4 rounded-xl border border-white/10 bg-gradient-to-r from-yellow-400/[0.06] to-transparent flex-wrap">
              <div className="w-16 h-16 shrink-0 flex items-center justify-center rounded-xl bg-black/30 border border-yellow-400/20 shadow-[0_0_20px_-4px_rgba(250,204,21,0.25)]">
                {itemImages(item).length > 0
                  ? <ItemImage images={itemImages(item)} alt={item.name} className="w-11 h-11 object-contain drop-shadow-lg" />
                  : <span className="text-3xl">⚔️</span>}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-yellow-400 truncate">{formatItemName(item)}</h1>
                {allSteps.length > 0 && (
                  <select value={ownedLevel} onChange={e => setOwnedLevel(e.target.value)} title={t('itemDetail.ownedLevelTooltip')}
                    className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-yellow-400 shrink-0">
                    <option value="-">-</option>
                    {Array.from({ length: 10 }, (_, n) => <option key={n} value={String(n)}>+{n}</option>)}
                  </select>
                )}
              </div>
              {isPvpItem && maxVariantCount > 1 && (
                <button type="button" onClick={cycleGlobalVariant}
                  className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 hover:text-yellow-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0">
                  {t('itemDetail.variant', { current: currentGlobalVariant, count: maxVariantCount })}
                </button>
              )}
            </div>

            {/* Matches the width of the step list below it, which is itself narrower
                than the page on large screens because the summary panel (lg:w-80 +
                gap-6 = 21.5rem) sits beside it — without this the overview box would
                render wider than the list and the two would look misaligned. */}
            <div className={!isRangedUpgradeItem ? 'lg:pr-[21.5rem]' : ''}>
              <CraftOverviewPanel
                allSteps={allSteps}
                grouped={grouped}
                yangCosts={yangCosts}
                onShowSummary={isRangedUpgradeItem ? () => setShowSummary(true) : undefined}
                horizontal
                skipCraftSection={!isRangedUpgradeItem}
              />
            </div>

            {!isRangedUpgradeItem && (
              <>
                {allSteps.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {scrolls.length > 0 && (
                      <button type="button" onClick={clearAllScrolls}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                        {t('itemDetail.noScrollsAllSteps')}
                      </button>
                    )}
                    {(scrolls.length > 0 || allSteps.some(s => s !== 0)) && (
                      <>
                        <button type="button" onClick={resetAllPity}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          {t('itemDetail.resetPityAllSteps')}
                        </button>
                        <button type="button" onClick={setAllPityToMax}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          {t('itemDetail.maxPityAllSteps')}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <UnlockerPicker
                  mats={unlockerMats}
                  selected={chosenUnlockers}
                  onToggle={toggleUnlocker}
                  priceOf={priceOf}
                  horizontal
                />
                {allSteps.length === 0 ? (
                  <EmptyState emoji="📭" text={t('itemDetail.noMaterialsDefined')} />
                ) : (
                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* No overflow-hidden here: it used to clip the seal picker's dropdown
                        for the last few rows, since that popup is an absolutely positioned
                        div that needs to escape this box, not a native <select> menu. */}
                    <div className="flex-1 min-w-0 w-full flex flex-col rounded-xl border border-white/10 bg-black/20">
                      {/* A real table: every row shares the same column tracks (level,
                          materials, scroll/seal picker, fails), so nothing drifts sideways
                          between rows just because one step has more materials than another. */}
                      <div className="hidden md:grid grid-cols-[13rem_1fr_9rem_6rem] gap-4 px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">
                        <div>{t('itemDetail.step0')}/+N</div>
                        <div>{t('common.material')}</div>
                        <div>Scroll / Seal</div>
                        <div className="text-right">Fails</div>
                      </div>

                      <div className="divide-y divide-white/5">
                      {allSteps.map(step => {
                        const scrollId = selectedScroll[step] ?? ''
                        const scrollMat = scrolls.find(s => s.id === scrollId)
                        const stepSealMats = (selectedSeals[step] ?? []).map(id => seals.find(s => s.id === id)).filter(Boolean)
                        const stepExcluded = !!excludedSteps[step]
                        const stepOwned = !!excludedStepsForOwnedLevel(ownedLevel)[step]
                        const max = maxPityByStep[step]
                        const hasExtras = !!scrollMat || stepSealMats.length > 0

                        return (
                          <div
                            key={step}
                            className={`grid grid-cols-1 md:grid-cols-[13rem_1fr_9rem_6rem] gap-x-4 gap-y-2 items-center px-5 py-3.5 transition-colors hover:bg-white/[0.03] ${stepExcluded ? 'opacity-40' : ''}`}
                          >
                            {/* Level */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 shrink-0 rounded-lg bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 font-bold text-xs">
                                {step === 0 ? '⚒' : `+${step}`}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-gray-400 truncate">{t(STEP_LABEL_KEYS[step])}</span>
                                <span className={`text-sm font-bold font-mono ${stepExcluded ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                                  {formatYang(stepTotal(step))}
                                </span>
                              </div>
                            </div>

                            {/* Fee, materials, and the chosen scroll/seal each get their own
                                line instead of all wrapping together in one crowded row.
                                Craft (step 0) never has a scroll/seal, so it spans that picker
                                track too instead of leaving it empty. */}
                            <div className={`flex flex-col gap-2 min-w-0 py-1 ${step === 0 ? 'md:col-span-2' : ''}`}>
                              {yangCosts[step] > 0 && (
                                <div className="flex items-center gap-2 shrink-0" title={t('itemDetail.yangFee')}>
                                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/25 shrink-0">
                                    <span className="text-sm">💰</span>
                                  </div>
                                  <span className="text-xs text-yellow-400 font-mono">{formatYang(yangCosts[step] * getPity(step))}</span>
                                </div>
                              )}
                              {/* Quantities scale with the fail-count stepper on the right —
                                  more attempts means more materials actually needed. */}
                              <div className="flex flex-wrap items-start gap-3">
                                {(grouped[step] ?? []).map(row => (
                                  <MatTag
                                    key={`${row.kind}-${row.material.id}`}
                                    mat={row.kind === 'item' ? { ...row.material, name: formatItemName(row.material) } : row.material}
                                    quantity={row.quantity * getPity(step)}
                                    kind={row.kind}
                                    hidePrice
                                  />
                                ))}
                              </div>
                              {hasExtras && (
                                <div className="flex flex-wrap items-start gap-3">
                                  {scrollMat && <MatTag mat={scrollMat} quantity={getPity(step)} kind="material" hidePrice />}
                                  {stepSealMats.map(s => <MatTag key={s.id} mat={s} quantity={getPity(step)} kind="material" hidePrice />)}
                                </div>
                              )}
                            </div>

                            {step !== 0 && (
                              /* Scroll + seal pickers, stacked in one column. */
                              <div className="flex flex-col gap-2 min-w-0">
                                {scrolls.length > 0 && (
                                  <ScrollPicker scrolls={scrolls} value={scrollId} onChange={id => setSelectedScroll(prev => ({ ...prev, [step]: id }))} />
                                )}
                                {seals.length > 0 && (
                                  <SealPicker seals={seals} selected={selectedSeals[step] ?? []} onChange={val => setSelectedSeals(prev => ({ ...prev, [step]: val }))} horizontal />
                                )}
                              </div>
                            )}

                            {/* Fails + include-step. Craft's checkbox is a shortcut for the
                                same thing the "-"/+0 select in the header already does — it
                                just flips ownedLevel between "-" and "0" instead of cascading
                                through manualExcludedSteps like the upgrade steps' checkbox. */}
                            <div className="flex items-center gap-2 md:justify-end">
                              {step === 0 ? (
                                <label className="flex items-center gap-1 text-gray-500 cursor-pointer select-none shrink-0" title={t('itemDetail.includeStepTooltip')}>
                                  <input
                                    type="checkbox"
                                    checked={ownedLevel === '-'}
                                    onChange={() => setOwnedLevel(ownedLevel === '-' ? '0' : '-')}
                                    className="accent-yellow-400 w-3.5 h-3.5"
                                  />
                                </label>
                              ) : !stepOwned && (
                                <label className="flex items-center gap-1 text-gray-500 cursor-pointer select-none shrink-0" title={t('itemDetail.includeStepTooltip')}>
                                  <input type="checkbox" checked={!stepExcluded} onChange={() => toggleStepIncluded(step)} className="accent-yellow-400 w-3.5 h-3.5" />
                                </label>
                              )}
                              <PityStepper
                                value={getPityInput(step)}
                                max={max}
                                onChange={next => setPity(prev => ({ ...prev, [step]: String(next) }))}
                                title={maxPityByStep[step] != null ? t('itemDetail.pityMax', { max: maxPityByStep[step] }) : t('itemDetail.pity')}
                              />
                            </div>
                          </div>
                        )
                      })}
                      </div>
                    </div>

                    {/* Summary side panel */}
                    <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24 rounded-xl border border-yellow-400/20 bg-gradient-to-b from-yellow-400/[0.06] to-black/30 overflow-hidden">
                      <div className="px-6 py-5">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t('itemDetail.totalCost')}</span>
                        <div className="text-3xl font-bold text-yellow-400 font-mono mt-1">{formatYang(total)}</div>
                      </div>
                      <button type="button" onClick={() => setShowSummary(true)}
                        className="w-full flex items-center justify-center gap-1.5 border-t border-yellow-400/20 bg-black/20 hover:bg-yellow-400/10 text-yellow-300 hover:text-yellow-200 text-sm font-semibold px-4 py-3 transition-colors">
                        📋 {t('itemDetail.materialsSummary')}
                      </button>
                      <button type="button" onClick={() => setShowPriceAdjust(true)}
                        className="w-full flex items-center justify-center gap-1.5 border-t border-yellow-400/20 bg-black/20 hover:bg-yellow-400/10 text-yellow-300 hover:text-yellow-200 text-sm font-semibold px-4 py-3 transition-colors">
                        💲 Adjust prices
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {showSummary && (() => {
        const { rows } = buildMaterialsSummary()
        return (
          <Modal title={t('itemDetail.materialsSummaryTitle')} onClose={() => setShowSummary(false)} horizontal>
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

      {showPriceAdjust && (() => {
        const { rows } = buildMaterialsSummary()
        return (
          <Modal title="Adjust prices" onClose={() => setShowPriceAdjust(false)} maxWidthClass="max-w-xl" horizontal>
            <div className="flex justify-center mb-4">
              <PriceModeToggle mode={mode} setMode={setMode} horizontal />
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">{t('itemDetail.noMaterialsDefined')}</p>
            ) : (
              // One shared grid for every row (not one grid per row) — otherwise each
              // row's "1fr" name column is measured against only its own price cell's
              // width, so the checkbox/price columns drift left or right row to row.
              <div className="grid grid-cols-[2.25rem_1fr_1.25rem_7.5rem] gap-x-3">
                {rows.map(row => {
                  const unitPrice = row.kind === 'item' ? computeItemPrice(row.material.id, itemIngredientCtx()) : priceOf(row.material.id)
                  const manualOverride = manualOverrides?.has(row.material.id) ?? false
                  const canOverride = !row.material.no_price && !FIXED_MATERIAL_PRICES[row.material.id]
                  return (
                    <Fragment key={`${row.kind}-${row.material.id}`}>
                      <div className="flex items-center border-t border-white/10 py-2.5">
                        <div className="w-9 h-9 shrink-0 rounded-lg bg-black/25 flex items-center justify-center overflow-hidden">
                          {row.material.image_url
                            ? <img src={row.material.image_url} alt={row.material.name} className="w-6 h-6 object-contain" />
                            : <span className="text-sm">{row.kind === 'item' ? '⚔️' : '🧪'}</span>}
                        </div>
                      </div>
                      <div className="flex items-center min-w-0 border-t border-white/10 py-2.5">
                        <span className="truncate text-sm text-gray-200">{row.material.name}</span>
                      </div>
                      {/* Always-present slot, checkbox or not, so the price cell after it
                          lines up in the same column on every row. */}
                      <div className="flex items-center justify-center border-t border-white/10 py-2.5">
                        {canOverride && (
                          <label className="flex items-center cursor-pointer select-none" title={t('materials.manualPrice')}>
                            <input type="checkbox" checked={manualOverride} onChange={() => toggleManualOverride(row.material.id)} className="accent-yellow-400 w-3 h-3" />
                          </label>
                        )}
                      </div>
                      <div className="flex items-center border-t border-white/10 py-2.5">
                        <MaterialPriceCell
                          material={row.material}
                          rawValue={rawInputs[row.material.id]}
                          computedValue={unitPrice}
                          onPriceChange={setPrice}
                          computed={manualOverride ? false : (row.kind === 'item' || mode === 'global' ? true : undefined)}
                          manualOverride={manualOverride}
                          allowGlobalSubmit={row.kind !== 'item'}
                        />
                      </div>
                    </Fragment>
                  )
                })}
              </div>
            )}
          </Modal>
        )
      })()}
    </div>
  )
}
