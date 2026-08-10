import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import SealPicker from '../components/SealPicker'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'
import { formatYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import ItemImage from '../components/ItemImage'
import MatRow from '../components/MatRow'
import MaterialTile from '../components/MaterialTile'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap,
  computeItemPrice, buildItemStepMap, buildItemYangMap, buildItemMaxPityMap, buildDefaultScrollMap,
  fetchGlobalPrices, makeMaterialPriceFn,
} from '../utils/priceBook'

const STEP_LABEL_KEYS = {
  0: 'itemDetail.step0', 1: 'itemDetail.step1', 2: 'itemDetail.step2', 3: 'itemDetail.step3',
  4: 'itemDetail.step4', 5: 'itemDetail.step5', 6: 'itemDetail.step6',
  7: 'itemDetail.step7', 8: 'itemDetail.step8', 9: 'itemDetail.step9',
}

const SCROLL_ORDER = [
  'Blessing Scroll', 'Dragon Scroll', 'Scroll of Honor',
  'Blacksmith Handbook', 'Scroll of War', 'Magic Stone',
]

export default function ItemDetail() {
  const { t } = useTranslation()
  const { itemId } = useParams()
  const [item, setItem] = useState(null)
  const [grouped, setGrouped] = useState({})
  const [yangCosts, setYangCosts] = useState({})
  const [maxPityByStep, setMaxPityByStep] = useState({})
  const [scrolls, setScrolls] = useState([])
  const [seals, setSeals] = useState([])
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [allItemMaterials, setAllItemMaterials] = useState({})
  const [allItemItems, setAllItemItems] = useState({})
  const [allItemYang, setAllItemYang] = useState({})
  const [allItemMaxPity, setAllItemMaxPity] = useState({})
  const [defaultScrollByStep, setDefaultScrollByStep] = useState({})
  const [selectedScroll, setSelectedScroll] = useState({})
  const [selectedSeals, setSelectedSeals] = useState({})
  const [pity, setPity] = useState({})
  const [includeCraft, setIncludeCraft] = useState(true)
  const [excludedSteps, setExcludedSteps] = useState({})
  const [showSummary, setShowSummary] = useState(false)
  const [globalPrices, setGlobalPrices] = useState({})
  const [chapterName, setChapterName] = useState(null)
  const [categoryName, setCategoryName] = useState(null)
  const [loading, setLoading] = useState(true)
  const { rawInputs, setPrice, mode } = usePriceBook()

  useEffect(() => {
    Promise.all([
      supabase.from('items').select('*').eq('id', itemId).single(),
      supabase.from('item_materials').select('quantity, step, material:materials(id, name, image_url, is_craftable)').eq('item_id', itemId).order('step'),
      supabase.from('item_items').select('quantity, step, component:items!item_items_component_item_id_fkey(id, name, image_url)').eq('item_id', itemId).order('step'),
      supabase.from('item_step_yang').select('step, yang_cost, max_pity').eq('item_id', itemId),
      supabase.from('materials').select('id, name, image_url, is_craftable').eq('is_upgrade_scroll', true).order('name'),
      supabase.from('materials').select('id, name, image_url, is_craftable').eq('is_seal', true).order('name'),
      supabase.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      supabase.from('materials').select('id, craft_yang_cost'),
      supabase.from('item_materials').select('item_id, material_id, quantity, step'),
      supabase.from('item_items').select('item_id, component_item_id, quantity, step'),
      supabase.from('item_step_yang').select('item_id, step, yang_cost, max_pity'),
      fetchGlobalPrices(),
    ]).then(([itemRes, matsRes, itemIngRes, yangRes, scrollsRes, sealsRes, recipeRes, allMatsRes, allItemMatsRes, allItemItemsRes, allItemYangRes, globalPricesMap]) => {
      setItem(itemRes.data)

      const g = {}
      for (const row of matsRes.data ?? []) {
        if (!g[row.step]) g[row.step] = []
        g[row.step].push({ material: row.material, quantity: row.quantity, kind: 'material' })
      }
      for (const row of itemIngRes.data ?? []) {
        if (!g[row.step]) g[row.step] = []
        g[row.step].push({ material: row.component, quantity: row.quantity, kind: 'item' })
      }
      setGrouped(g)

      const yc = {}
      const mp = {}
      for (const row of yangRes.data ?? []) {
        yc[row.step] = row.yang_cost
        if (row.max_pity) mp[row.step] = row.max_pity
      }
      setYangCosts(yc)
      setMaxPityByStep(mp)

      const sorted = (scrollsRes.data ?? []).sort((a, b) => {
        const ai = SCROLL_ORDER.findIndex(n => a.name.toLowerCase().includes(n.toLowerCase()))
        const bi = SCROLL_ORDER.findIndex(n => b.name.toLowerCase().includes(n.toLowerCase()))
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      setScrolls(sorted)
      setSeals(sealsRes.data ?? [])
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(allMatsRes.data))
      setAllItemMaterials(buildItemStepMap(allItemMatsRes.data))
      setAllItemItems(buildItemStepMap(allItemItemsRes.data))
      setAllItemYang(buildItemYangMap(allItemYangRes.data))
      setAllItemMaxPity(buildItemMaxPityMap(allItemYangRes.data))
      setDefaultScrollByStep(buildDefaultScrollMap(sorted))
      setGlobalPrices(globalPricesMap)

      setExcludedSteps({})

      const saved = localStorage.getItem(`item_choices_${itemId}`)
      const savedChoices = saved ? JSON.parse(saved) : null

      if (savedChoices) {
        setSelectedScroll(savedChoices.selectedScroll ?? {})
        setSelectedSeals(savedChoices.selectedSeals ?? {})
        setPity(savedChoices.pity ?? {})
        setIncludeCraft(savedChoices.includeCraft ?? true)
      } else {
        const war = sorted.find(s => s.name.toLowerCase().includes('scroll of war'))
        const magic = sorted.find(s => s.name.toLowerCase().includes('magic stone'))
        if (war || magic) {
          setSelectedScroll({
            1: war?.id ?? '', 2: war?.id ?? '', 3: war?.id ?? '', 4: war?.id ?? '',
            5: magic?.id ?? '', 6: magic?.id ?? '', 7: magic?.id ?? '', 8: magic?.id ?? '', 9: magic?.id ?? '',
          })
        }
      }

      setLoading(false)
    })
  }, [itemId])

  useEffect(() => {
    if (!item) return
    Promise.all([
      supabase.from('categories').select('name').eq('id', item.category_id).single(),
      item.subcategory_id ? supabase.from('subcategories').select('name').eq('id', item.subcategory_id).single() : Promise.resolve({ data: null }),
    ]).then(([catRes, subRes]) => {
      setChapterName(catRes.data?.name ?? null)
      setCategoryName(subRes.data?.name ?? null)
    })
  }, [item])

  useEffect(() => {
    if (loading) return
    localStorage.setItem(`item_choices_${itemId}`, JSON.stringify({ selectedScroll, selectedSeals, pity, includeCraft }))
  }, [itemId, loading, selectedScroll, selectedSeals, pity, includeCraft])

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
      for (let s = 0; s <= 9; s++) next[s] = 1
      return next
    })
  }

  function setAllPityToMax() {
    setPity(prev => {
      const next = { ...prev }
      for (let s = 0; s <= 9; s++) {
        if (maxPityByStep[s]) next[s] = maxPityByStep[s]
      }
      return next
    })
  }

  function toggleStepIncluded(step) {
    setExcludedSteps(prev => {
      const next = { ...prev }
      if (prev[step]) {
        // including this step implies every lower step must be reached too
        for (let s = 1; s <= step; s++) next[s] = false
      } else {
        // excluding this step means every higher step is unreachable too
        for (let s = step; s <= 9; s++) next[s] = true
      }
      return next
    })
  }

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts })

  function priceOf(materialId) {
    return priceFn(materialId)
  }

  function itemIngredientCtx() {
    return {
      materialPriceFn: priceFn,
      itemMaterials: allItemMaterials,
      itemItems: allItemItems,
      itemYang: allItemYang,
      itemMaxPity: allItemMaxPity,
      defaultScrollByStep,
    }
  }

  function rowPrice(row) {
    return row.kind === 'item' ? computeItemPrice(row.material.id, itemIngredientCtx()) : priceOf(row.material.id)
  }

  function getPity(step) {
    const val = Math.max(1, parseInt(pity[step]) || 1)
    const max = maxPityByStep[step]
    return max ? Math.min(val, max) : val
  }
  function matCost(rows) { return rows.reduce((s, r) => s + rowPrice(r) * r.quantity, 0) }
  function scrollCost(step) { const id = selectedScroll[step]; return id ? priceOf(id) : 0 }
  function sealsCost(step) { return (selectedSeals[step] ?? []).reduce((s, id) => s + priceOf(id), 0) }
  function stepTotal(step) { return (matCost(grouped[step] ?? []) + (yangCosts[step] ?? 0) + scrollCost(step) + sealsCost(step)) * getPity(step) }

  const allSteps = [...new Set([...Object.keys(grouped).map(Number), ...Object.keys(yangCosts).map(Number)])].sort((a, b) => a - b)
  function isStepIncluded(step) { return !(step === 0 && !includeCraft) && !excludedSteps[step] }
  const total = allSteps.reduce((s, step) => isStepIncluded(step) ? s + stepTotal(step) : s, 0)

  function buildMaterialsSummary() {
    const map = new Map()

    function addRow(material, kind, qty) {
      const key = `${kind}-${material.id}`
      const existing = map.get(key)
      if (existing) existing.quantity += qty
      else map.set(key, { material, kind, quantity: qty })
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

    const rows = [...map.values()].sort((a, b) => a.material.name.localeCompare(b.material.name))
    return { rows }
  }

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            <Breadcrumbs items={[
              { label: t('common.home'), to: '/' },
              { label: chapterName ?? t('common.chapter'), to: `/chapter/${item.category_id}` },
              ...(item.subcategory_id
                ? [{ label: categoryName ?? t('common.category'), to: `/chapter/${item.category_id}/sub/${item.subcategory_id}` }]
                : []),
              { label: item?.name ?? t('common.item') },
            ]} />

            {/* Item header */}
            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {itemImages(item).length > 0
                  ? <ItemImage images={itemImages(item)} alt={item.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">⚔️</span>}
              </div>
              <h1 className="text-2xl font-bold text-yellow-400">{item?.name}</h1>
              {mode === 'global' && (
                <span className="ml-auto text-xs bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-1 rounded-full shrink-0">
                  {t('materials.globalPrices')}
                </span>
              )}
            </div>

            {allSteps.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {scrolls.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllScrolls}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {t('itemDetail.noScrollsAllSteps')}
                  </button>
                )}
                {(scrolls.length > 0 || allSteps.some(s => s !== 0)) && (
                  <>
                    <button
                      type="button"
                      onClick={resetAllPity}
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {t('itemDetail.resetPityAllSteps')}
                    </button>
                    <button
                      type="button"
                      onClick={setAllPityToMax}
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {t('itemDetail.maxPityAllSteps')}
                    </button>
                  </>
                )}
              </div>
            )}

            {allSteps.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">{t('itemDetail.noMaterialsDefined')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {allSteps.map(step => {
                  const scrollId = selectedScroll[step] ?? ''
                  const scrollMat = scrolls.find(s => s.id === scrollId)
                  const stepSealMats = (selectedSeals[step] ?? []).map(id => seals.find(s => s.id === id)).filter(Boolean)
                  const hasExtras = scrollMat || stepSealMats.length > 0

                  const stepExcluded = step !== 0 && !!excludedSteps[step]

                  return (
                    <div key={step} className={`bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden${stepExcluded ? ' opacity-50' : ''}`}>
                      {/* Step header bar */}
                      <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700 flex-wrap gap-2">
                        <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest">
                          {t(STEP_LABEL_KEYS[step])}
                        </h2>
                        <div className="flex items-center gap-2 flex-wrap">
                          {step !== 0 && (
                            <label
                              className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none"
                              title={t('itemDetail.includeStepTooltip')}
                            >
                              <input
                                type="checkbox"
                                checked={!stepExcluded}
                                onChange={() => toggleStepIncluded(step)}
                                className="accent-yellow-400 w-3.5 h-3.5"
                              />
                              {t('itemDetail.includeStep')}
                            </label>
                          )}
                          {step !== 0 && scrolls.length > 0 && (
                            <select
                              value={scrollId}
                              onChange={e => setSelectedScroll(prev => ({ ...prev, [step]: e.target.value }))}
                              className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-400"
                            >
                              <option value="">{t('itemDetail.noScroll')}</option>
                              {scrolls.map(s => {
                                const isMagic = s.name.toLowerCase().includes('magic stone')
                                return <option key={s.id} value={s.id}>{isMagic ? `⭐ ${s.name}` : s.name}</option>
                              })}
                            </select>
                          )}
                          {step !== 0 && seals.length > 0 && (
                            <SealPicker
                              seals={seals}
                              selected={selectedSeals[step] ?? []}
                              onChange={val => setSelectedSeals(prev => ({ ...prev, [step]: val }))}
                            />
                          )}
                          <label className="flex items-center gap-1.5 text-xs text-gray-400">
                            {maxPityByStep[step] ? t('itemDetail.pityMax', { max: maxPityByStep[step] }) : t('itemDetail.pity')}:
                            <input
                              type="number"
                              min="1"
                              max={maxPityByStep[step] || undefined}
                              value={pity[step] ?? 1}
                              onChange={e => {
                                const raw = e.target.value
                                const max = maxPityByStep[step]
                                const clamped = max && Number(raw) > max ? String(max) : raw
                                setPity(prev => ({ ...prev, [step]: clamped }))
                              }}
                              className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-14 text-center text-xs text-white focus:outline-none focus:border-yellow-400"
                            />
                            <span className={`text-yellow-400 font-bold min-w-[1.75rem] shrink-0 ${getPity(step) > 1 ? '' : 'opacity-0'}`}>×{getPity(step)}</span>
                          </label>
                        </div>
                      </div>

                      {/* Step body */}
                      <div className="px-5 py-4 flex flex-col gap-3">
                        {/* Yang fee */}
                        {yangCosts[step] > 0 && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                              <span className="text-lg">💰</span>
                            </div>
                            <span className="flex-1 text-sm text-gray-400">{t('itemDetail.yangFee')}</span>
                            <span className="text-yellow-400 text-sm font-mono">{formatYang(yangCosts[step])}</span>
                          </div>
                        )}

                        {(grouped[step] ?? []).map(row => (
                          <MatRow key={`${row.kind}-${row.material.id}`} mat={row.material} quantity={row.quantity} unitPrice={rowPrice(row)} rawValue={rawInputs[row.material.id]} onPriceChange={setPrice} kind={row.kind} globalMode={mode === 'global'} />
                        ))}

                        {hasExtras && (
                          <div className="border-t border-gray-700/60 pt-3 flex flex-col gap-3">
                            {scrollMat && <MatRow mat={scrollMat} quantity={1} unitPrice={priceOf(scrollMat.id)} rawValue={rawInputs[scrollMat.id]} onPriceChange={setPrice} globalMode={mode === 'global'} />}
                            {stepSealMats.map(s => <MatRow key={s.id} mat={s} quantity={1} unitPrice={priceOf(s.id)} rawValue={rawInputs[s.id]} onPriceChange={setPrice} globalMode={mode === 'global'} />)}
                          </div>
                        )}
                      </div>

                      {/* Subtotal */}
                      <div className="flex justify-between items-center px-5 py-3 bg-gray-800/40 border-t border-gray-700">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                          {t('itemDetail.subtotal')}{getPity(step) > 1 ? ` ×${getPity(step)}` : ''}
                          {stepExcluded && ` (${t('itemDetail.excludedFromTotal')})`}
                        </span>
                        <span className={`text-sm font-bold font-mono ${stepExcluded ? 'text-gray-600 line-through' : 'text-yellow-400'}`}>{formatYang(stepTotal(step))}</span>
                      </div>
                    </div>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setShowSummary(true)}
                  className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 hover:text-yellow-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {t('itemDetail.materialsSummary')}
                </button>

                {/* Total card */}
                <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1">
                  {allSteps.includes(0) && (
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-4 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeCraft}
                        onChange={e => setIncludeCraft(e.target.checked)}
                        className="accent-yellow-400 w-4 h-4"
                      />
                      {t('itemDetail.includeCraftCost')}
                    </label>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-semibold">{t('itemDetail.totalCost')}</span>
                    <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </>
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
