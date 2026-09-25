import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { formatYang } from '../utils/formatYang'
import { slugify } from '../utils/slug'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap, fetchGlobalPrices, makeMaterialPriceFn, FIXED_MATERIAL_PRICES,
} from '../utils/priceBook'
import {
  MAT, MOUNT_TABS_BY_CATEGORY, LEVEL_STAGES, BONUS_ENCHANTS, DEFAULT_ENCHANT_QTY,
  MOUNT_SKILLS, SKILL_LEVELS, DEFAULT_BOOKS_PER_LEVEL,
  RUNES, RUNE_STEPS, RUNE_MAX_PITY, runeStepMats,
} from '../utils/mountSystem'
import MatRow from './MatRow'
import MaterialTile from './MaterialTile'
import Modal from './Modal'
import CraftOverviewPanel from './CraftOverviewPanel'
import MaterialPriceCell from './MaterialPriceCell'
import { MatTag, PityStepper } from '../horizontal/ui'
import PriceModeToggle from './PriceModeToggle'
import StickyTotalBar, { useStickyTotal } from './StickyTotalBar'
import Spinner from './Spinner'

const STORAGE_KEY = 'mount_calc_choices'

function defaultChoices() {
  return {
    stages: Object.fromEntries(LEVEL_STAGES.map(s => [s.key, true])),
    enchantQty: Object.fromEntries(BONUS_ENCHANTS.map(k => [k, String(DEFAULT_ENCHANT_QTY)])),
    skills: Object.fromEntries(MOUNT_SKILLS.map(s => [s.key, { enabled: true, books: String(DEFAULT_BOOKS_PER_LEVEL), reading: false }])),
    runes: Object.fromEntries(RUNES.map(r => [r.key, { owned: 0, pity: {}, excluded: {} }])),
  }
}

function loadChoices() {
  const base = defaultChoices()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!saved) return base
    return {
      stages: { ...base.stages, ...saved.stages },
      enchantQty: { ...base.enchantQty, ...saved.enchantQty },
      skills: Object.fromEntries(MOUNT_SKILLS.map(s => [s.key, { ...base.skills[s.key], ...saved.skills?.[s.key] }])),
      runes: Object.fromEntries(RUNES.map(r => [r.key, { ...base.runes[r.key], ...saved.runes?.[r.key] }])),
    }
  } catch {
    return base
  }
}

const toQty = raw => Math.max(0, parseInt(raw) || 0)

// Steps a rune still needs (above the owned level, not excluded), with the
// pity multiplier applied: pity N = the step is paid N+1 times.
function runeActiveSteps(rune, c) {
  const steps = []
  for (let step = c.owned + 1; step <= RUNE_STEPS; step++) {
    if (c.excluded[step]) continue
    const mult = Math.min(RUNE_MAX_PITY, Math.max(0, c.pity[step] ?? 0)) + 1
    steps.push({ step, mult })
  }
  return steps
}

function addRune(acc, rune, c) {
  let fee = 0
  for (const { step, mult } of runeActiveSteps(rune, c)) {
    addMats(acc, runeStepMats(rune, step), mult)
    fee += rune.yang[step - 1] * mult
  }
  return fee
}

// Adds [matKey, qty] pairs into an { materialId: qty } accumulator.
function addMats(acc, pairs, factor = 1) {
  for (const [key, qty] of pairs) {
    const id = MAT[key]
    acc[id] = (acc[id] ?? 0) + qty * factor
  }
}

export default function MountSystem({ categoryId, horizontal = false }) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabs = MOUNT_TABS_BY_CATEGORY[categoryId] ?? []
  const tab = tabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : tabs[0]

  const [loading, setLoading] = useState(true)
  const [materialsById, setMaterialsById] = useState({})
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [globalPrices, setGlobalPrices] = useState({})
  const [noPriceIds, setNoPriceIds] = useState(new Set())
  const { rawInputs, setPrice, mode, setMode, manualOverrides, toggleManualOverride } = usePriceBook()
  const [stickyTotal, setStickyTotal] = useStickyTotal()
  const [choices, setChoices] = useState(loadChoices)
  const [showSummary, setShowSummary] = useState(false)
  const [showPriceAdjust, setShowPriceAdjust] = useState(false)
  const isRuneTab = RUNES.some(r => r.key === tab)

  useEffect(() => {
    Promise.all([
      db.from('materials').select('id, name, image_url, is_craftable, craft_yang_cost, no_price'),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      fetchGlobalPrices(),
    ]).then(([matsRes, recipeRes, globalMap]) => {
      const mats = matsRes.data ?? []
      setMaterialsById(Object.fromEntries(mats.map(m => [m.id, m])))
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(mats))
      setGlobalPrices(globalMap)
      setNoPriceIds(new Set(mats.filter(m => m.no_price).map(m => m.id)))
      setLoading(false)
    })
  }, [])

  function updateChoices(fn) {
    setChoices(prev => {
      const next = fn(prev)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts, manualOverrides, noPriceIds })

  // Per-tab materials + flat yang fees, driven by the user's choices.
  const { mats, yang } = useMemo(() => {
    const acc = {}
    let fee = 0
    if (tab === 'level') {
      for (const stage of LEVEL_STAGES) {
        if (!choices.stages[stage.key]) continue
        addMats(acc, stage.mats)
        fee += stage.yang
      }
    } else if (tab === 'bonus') {
      for (const key of BONUS_ENCHANTS) addMats(acc, [[key, toQty(choices.enchantQty[key])]])
    } else if (tab === 'all') {
      for (const rune of RUNES) fee += addRune(acc, rune, choices.runes[rune.key])
    } else if (RUNES.some(r => r.key === tab)) {
      const rune = RUNES.find(r => r.key === tab)
      fee += addRune(acc, rune, choices.runes[rune.key])
    } else if (tab === 'skills') {
      for (const skill of MOUNT_SKILLS) {
        const c = choices.skills[skill.key]
        if (!c.enabled) continue
        const books = toQty(c.books) * SKILL_LEVELS
        addMats(acc, [['skillUnlocker', 1], ['skillBook', books]])
        if (c.reading) addMats(acc, [['focusedReading', books]])
      }
    }
    return { mats: Object.entries(acc).filter(([, q]) => q > 0), yang: fee }
  }, [tab, choices])

  const materialsTotal = mats.reduce((sum, [id, qty]) => sum + priceFn(id) * qty, 0)
  const total = materialsTotal + yang

  const panel = horizontal ? 'bg-black/30 border border-white/10 rounded-xl' : 'bg-gray-900 border border-gray-700 rounded-2xl'
  const inputCls = horizontal
    ? 'bg-black/25 border border-white/10 rounded-lg px-2 py-1 w-20 text-right text-sm text-white focus:outline-none focus:border-yellow-400'
    : 'bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 w-20 text-right text-sm text-white focus:outline-none focus:border-yellow-400'

  function MatIcon({ matKey, size = 'w-8 h-8' }) {
    const m = materialsById[MAT[matKey]]
    if (!m) return <span className={`${size} shrink-0`} />
    return (
      <Link to={`/materials/${slugify(m.name)}`} title={m.name} className={`${size} shrink-0 flex items-center justify-center hover:opacity-75 transition-opacity`}>
        {m.image_url ? <img src={m.image_url} alt={m.name} className="w-full h-full object-contain" /> : <span className="text-lg">🧪</span>}
      </Link>
    )
  }

  function MatChip({ matKey, qty }) {
    const m = materialsById[MAT[matKey]]
    return (
      <span className="flex items-center gap-1.5 text-sm text-gray-200">
        <MatIcon matKey={matKey} size="w-7 h-7" />
        <span className="truncate">{m?.name ?? '?'}</span>
        <span className="text-gray-500 text-xs">×{qty}</span>
      </span>
    )
  }

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setSearchParams({ tab: key }, { replace: true })}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                tab === key
                  ? 'bg-yellow-400 text-gray-950 border-yellow-400'
                  : horizontal ? 'bg-black/30 border-white/10 text-gray-300 hover:text-yellow-400' : 'bg-gray-800 border-gray-600 text-gray-300 hover:text-yellow-400'
              }`}
            >
              {RUNES.some(r => r.key === key) ? (
                <span className="flex items-center gap-1.5">
                  <img src={RUNES.find(r => r.key === key).image} alt="" className="w-5 h-5" />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
              ) : t(`mount.tab.${key}`)}
            </button>
          ))}
        </div>
        {!isRuneTab && <PriceModeToggle mode={mode} setMode={setMode} horizontal={horizontal} />}
      </div>

      {tab === 'all' && (
        <div className={`${panel} divide-y ${horizontal ? 'divide-white/10' : 'divide-gray-700'}`}>
          {RUNES.map(rune => {
            const c = choices.runes[rune.key]
            const acc = {}
            const fee = addRune(acc, rune, c)
            const cost = fee + Object.entries(acc).reduce((sum, [id, qty]) => sum + priceFn(id) * qty, 0)
            return (
              <button
                key={rune.key}
                type="button"
                onClick={() => setSearchParams({ tab: rune.key }, { replace: true })}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${horizontal ? 'hover:bg-white/5' : 'hover:bg-gray-800'}`}
              >
                <img src={rune.image} alt={rune.name} className="w-8 h-8 shrink-0" />
                <span className="flex-1 text-sm font-semibold text-gray-100">{rune.name}</span>
                <span className="text-xs text-gray-500">+{c.owned} → +{RUNE_STEPS}</span>
                <span className="text-yellow-400 text-sm w-32 text-right font-mono shrink-0">{formatYang(cost)}</span>
              </button>
            )
          })}
        </div>
      )}

      {RUNES.filter(r => r.key === tab).map(rune => {
        const c = choices.runes[rune.key]
        const setRune = fn => updateChoices(prev => ({ ...prev, runes: { ...prev.runes, [rune.key]: fn(prev.runes[rune.key]) } }))
        const steps = Array.from({ length: RUNE_STEPS }, (_, i) => i + 1)
        const grouped = Object.fromEntries(steps.map(step => [
          step,
          runeStepMats(rune, step).map(([key, qty]) => ({ material: materialsById[MAT[key]], quantity: qty, kind: 'material' })).filter(r => r.material),
        ]))
        const yangCosts = Object.fromEntries(steps.map(step => [step, rune.yang[step - 1]]))
        const pityOf = step => Math.min(RUNE_MAX_PITY, Math.max(0, parseInt(c.pity[step]) || 0))
        const setPityOf = (step, value) => setRune(r => ({ ...r, pity: { ...r.pity, [step]: Math.min(RUNE_MAX_PITY, Math.max(0, parseInt(value) || 0)) } }))
        const stepTotal = step => (grouped[step].reduce((sum, r) => sum + priceFn(r.material.id) * r.quantity, 0) + yangCosts[step]) * (pityOf(step) + 1)
        const setAllPity = value => setRune(r => ({ ...r, pity: Object.fromEntries(steps.map(s => [s, value])) }))
        const isOwned = step => step <= c.owned
        const isExcluded = step => !isOwned(step) && !!c.excluded[step]
        const toggleIncluded = step => setRune(r => ({ ...r, excluded: { ...r.excluded, [step]: !r.excluded[step] } }))
        const ownedSelect = cls => (
          <select value={c.owned} onChange={e => setRune(r => ({ ...r, owned: Number(e.target.value) }))} title={t('itemDetail.ownedLevelTooltip')} className={cls}>
            {Array.from({ length: RUNE_STEPS }, (_, n) => <option key={n} value={n}>+{n}</option>)}
          </select>
        )
        const summaryRows = mats.filter(([id]) => materialsById[id])

        const summaryModal = showSummary && createPortal(
          <Modal title={t('itemDetail.materialsSummaryTitle')} onClose={() => setShowSummary(false)} horizontal={horizontal}>
            {summaryRows.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">{t('itemDetail.noMaterialsDefined')}</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {summaryRows.map(([id, qty]) => <MaterialTile key={id} mat={materialsById[id]} quantity={qty} />)}
              </div>
            )}
          </Modal>,
          document.body,
        )

        // Horizontal design: 1:1 with ItemDetailH (header band, step table,
        // side summary panel with total / materials summary / adjust prices).
        if (horizontal) {
          return (
            <div key={rune.key}>
              <div className="flex items-center gap-5 mb-4 px-5 py-4 rounded-xl border border-white/10 bg-gradient-to-r from-yellow-400/[0.06] to-transparent flex-wrap">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center rounded-xl bg-black/30 border border-yellow-400/20 shadow-[0_0_20px_-4px_rgba(250,204,21,0.25)]">
                  <img src={rune.image} alt={rune.name} className="w-11 h-11 object-contain drop-shadow-lg" />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-yellow-400 truncate">{rune.name}</h1>
                  {ownedSelect('bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-yellow-400 shrink-0')}
                </div>
              </div>

              <div className="lg:pr-[21.5rem]">
                <CraftOverviewPanel allSteps={steps} grouped={grouped} yangCosts={yangCosts} horizontal skipCraftSection />
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <button type="button" onClick={() => setAllPity(0)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                  {t('itemDetail.resetPityAllSteps')}
                </button>
                <button type="button" onClick={() => setAllPity(RUNE_MAX_PITY)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                  {t('itemDetail.maxPityAllSteps')}
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 min-w-0 w-full flex flex-col rounded-xl border border-white/10 bg-black/20">
                  <div className="hidden md:grid grid-cols-[13rem_1fr_6rem] gap-4 px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">
                    <div>+N</div>
                    <div>{t('common.material')}</div>
                    <div className="text-right">Fails</div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {steps.map(step => {
                      const owned = isOwned(step)
                      const excluded = isExcluded(step)
                      const mult = pityOf(step) + 1
                      return (
                        <div key={step} className={`grid grid-cols-1 md:grid-cols-[13rem_1fr_6rem] gap-x-4 gap-y-2 items-center px-5 py-3.5 transition-colors hover:bg-white/[0.03] ${owned || excluded ? 'opacity-40' : ''}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 shrink-0 rounded-lg bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center text-yellow-400 font-bold text-xs">
                              +{step}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-gray-400 truncate">+{step - 1} → +{step}</span>
                              <span className={`text-sm font-bold font-mono ${owned || excluded ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                                {formatYang(stepTotal(step))}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 min-w-0 py-1">
                            <div className="flex items-center gap-2 shrink-0" title={t('itemDetail.yangFee')}>
                              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/25 shrink-0">
                                <span className="text-sm">💰</span>
                              </div>
                              <span className="text-xs text-yellow-400 font-mono">{formatYang(yangCosts[step] * mult)}</span>
                            </div>
                            <div className="flex flex-wrap items-start gap-3">
                              {grouped[step].map(row => (
                                <MatTag key={row.material.id} mat={row.material} quantity={row.quantity * mult} kind="material" hidePrice />
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 md:justify-end">
                            {!owned && (
                              <label className="flex items-center gap-1 text-gray-500 cursor-pointer select-none shrink-0" title={t('itemDetail.includeStepTooltip')}>
                                <input type="checkbox" checked={!excluded} onChange={() => toggleIncluded(step)} className="accent-yellow-400 w-3.5 h-3.5" />
                              </label>
                            )}
                            <PityStepper
                              value={pityOf(step)}
                              max={RUNE_MAX_PITY}
                              onChange={next => setPityOf(step, next)}
                              title={t('itemDetail.pityMax', { max: RUNE_MAX_PITY })}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

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

              {summaryModal}
              {showPriceAdjust && createPortal(
                <Modal title="Adjust prices" onClose={() => setShowPriceAdjust(false)} maxWidthClass="max-w-xl" horizontal>
                  <div className="flex justify-center mb-4">
                    <PriceModeToggle mode={mode} setMode={setMode} horizontal />
                  </div>
                  {summaryRows.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">{t('itemDetail.noMaterialsDefined')}</p>
                  ) : (
                    <div className="grid grid-cols-[2.25rem_1fr_1.25rem_7.5rem] gap-x-3">
                      {summaryRows.map(([id]) => {
                        const mat = materialsById[id]
                        const manualOverride = manualOverrides?.has(id) ?? false
                        const canOverride = !mat.no_price && !FIXED_MATERIAL_PRICES[id]
                        return (
                          <Fragment key={id}>
                            <div className="flex items-center border-t border-white/10 py-2.5">
                              <div className="w-9 h-9 shrink-0 rounded-lg bg-black/25 flex items-center justify-center overflow-hidden">
                                {mat.image_url
                                  ? <img src={mat.image_url} alt={mat.name} className="w-6 h-6 object-contain" />
                                  : <span className="text-sm">🧪</span>}
                              </div>
                            </div>
                            <div className="flex items-center min-w-0 border-t border-white/10 py-2.5">
                              <span className="truncate text-sm text-gray-200">{mat.name}</span>
                            </div>
                            <div className="flex items-center justify-center border-t border-white/10 py-2.5">
                              {canOverride && (
                                <label className="flex items-center cursor-pointer select-none" title={t('materials.manualPrice')}>
                                  <input type="checkbox" checked={manualOverride} onChange={() => toggleManualOverride(id)} className="accent-yellow-400 w-3 h-3" />
                                </label>
                              )}
                            </div>
                            <div className="flex items-center border-t border-white/10 py-2.5">
                              <MaterialPriceCell
                                material={mat}
                                rawValue={rawInputs[id]}
                                computedValue={priceFn(id)}
                                onPriceChange={setPrice}
                                computed={manualOverride ? false : (mode === 'global' ? true : undefined)}
                                manualOverride={manualOverride}
                              />
                            </div>
                          </Fragment>
                        )
                      })}
                    </div>
                  )}
                </Modal>,
                document.body,
              )}
            </div>
          )
        }

        // Vertical design: 1:1 with ItemDetail (header card, overview table,
        // step cards with per-material prices, sticky total + materials summary).
        return (
          <div key={rune.key}>
            <div className="flex items-center gap-5 mb-6 p-5 bg-gray-900 border border-gray-700 rounded-2xl flex-wrap">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                <img src={rune.image} alt={rune.name} className="w-full h-full object-contain drop-shadow-lg" />
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-yellow-400">{rune.name}</h1>
                {ownedSelect('bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-yellow-400 shrink-0')}
              </div>
              <PriceModeToggle mode={mode} setMode={setMode} />
            </div>

            <CraftOverviewPanel allSteps={steps} grouped={grouped} yangCosts={yangCosts} skipCraftSection />

            <div className="flex flex-wrap gap-2 mb-6">
              <button type="button" onClick={() => setAllPity(0)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                {t('itemDetail.resetPityAllSteps')}
              </button>
              <button type="button" onClick={() => setAllPity(RUNE_MAX_PITY)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                {t('itemDetail.maxPityAllSteps')}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {steps.map(step => {
                const owned = isOwned(step)
                const excluded = isExcluded(step)
                const mult = pityOf(step) + 1
                return (
                  <div key={step} className={`bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden${owned || excluded ? ' opacity-50' : ''}`}>
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700 flex-wrap gap-2">
                      <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest">+{step - 1} → +{step}</h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        {!owned && (
                          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none" title={t('itemDetail.includeStepTooltip')}>
                            <input type="checkbox" checked={!excluded} onChange={() => toggleIncluded(step)} className="accent-yellow-400 w-3.5 h-3.5" />
                            {t('itemDetail.includeStep')}
                          </label>
                        )}
                        <label className="flex items-center gap-1.5 text-xs text-gray-400">
                          {t('itemDetail.pityMax', { max: RUNE_MAX_PITY })}:
                          <input
                            type="number"
                            min="0"
                            max={RUNE_MAX_PITY}
                            value={pityOf(step)}
                            onChange={e => setPityOf(step, e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-14 text-center text-xs text-white focus:outline-none focus:border-yellow-400"
                          />
                          <span className={`text-yellow-400 font-bold min-w-[1.75rem] shrink-0 ${mult > 1 ? '' : 'opacity-0'}`}>×{mult}</span>
                        </label>
                      </div>
                    </div>

                    <div className="px-5 py-4 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 shrink-0 flex items-center justify-center"><span className="text-lg">💰</span></div>
                        <span className="flex-1 text-sm text-gray-400">{t('itemDetail.yangFee')}</span>
                        <span className="text-yellow-400 text-sm font-mono">{formatYang(yangCosts[step])}</span>
                      </div>
                      {grouped[step].map(row => (
                        <MatRow
                          key={row.material.id}
                          mat={row.material}
                          quantity={row.quantity}
                          unitPrice={priceFn(row.material.id)}
                          rawValue={rawInputs[row.material.id]}
                          onPriceChange={setPrice}
                          globalMode={mode === 'global'}
                          manualOverrides={manualOverrides}
                          onToggleManualOverride={toggleManualOverride}
                        />
                      ))}
                    </div>

                    <div className="flex justify-between items-center px-5 py-3 bg-gray-800/40 border-t border-gray-700">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">
                        {owned ? t('mount.alreadyOwned') : `${t('itemDetail.subtotal')}${mult > 1 ? ` ×${mult}` : ''}`}
                        {excluded && ` (${t('itemDetail.excludedFromTotal')})`}
                      </span>
                      <span className={`text-sm font-bold font-mono ${owned || excluded ? 'text-gray-600 line-through' : 'text-yellow-400'}`}>{formatYang(stepTotal(step))}</span>
                    </div>
                  </div>
                )
              })}

              <StickyTotalBar sticky={stickyTotal}>
                <button
                  type="button"
                  onClick={() => setShowSummary(true)}
                  className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 hover:text-yellow-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {t('itemDetail.materialsSummary')}
                </button>
                <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-semibold">{t('itemDetail.totalCost')}</span>
                    <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mt-3 cursor-pointer select-none">
                    <input type="checkbox" checked={stickyTotal} onChange={e => setStickyTotal(e.target.checked)} className="accent-yellow-400 w-3.5 h-3.5" />
                    {t('common.stickToBottom')}
                  </label>
                </div>
              </StickyTotalBar>
            </div>

            {summaryModal}
          </div>
        )
      })}

      {tab === 'level' && (
        <div className={`${panel} divide-y ${horizontal ? 'divide-white/10' : 'divide-gray-700'}`}>
          {LEVEL_STAGES.map(stage => {
            const on = choices.stages[stage.key]
            return (
              <label key={stage.key} className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 cursor-pointer ${on ? '' : 'opacity-50'}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => updateChoices(c => ({ ...c, stages: { ...c.stages, [stage.key]: !on } }))}
                  className="accent-yellow-400 w-4 h-4 shrink-0"
                />
                <span className="w-44 shrink-0">
                  <span className="block text-sm font-semibold text-gray-100">
                    {stage.kind === 'evo' ? t('mount.evolution', { n: stage.evo }) : t('mount.levels')}
                  </span>
                  <span className="block text-xs text-gray-500">{t('mount.levelRange', { range: stage.label })}</span>
                </span>
                <span className="flex flex-wrap gap-x-5 gap-y-2 flex-1">
                  {stage.mats.map(([key, qty]) => <MatChip key={key} matKey={key} qty={qty} />)}
                </span>
                {stage.yang > 0 && <span className="text-yellow-400 text-sm font-mono">{formatYang(stage.yang)}</span>}
              </label>
            )
          })}
        </div>
      )}

      {tab === 'bonus' && (
        <div className={`${panel} divide-y ${horizontal ? 'divide-white/10' : 'divide-gray-700'}`}>
          <p className="px-5 py-3 text-xs text-gray-500">{t('mount.bonusHint')}</p>
          {BONUS_ENCHANTS.map(key => {
            const m = materialsById[MAT[key]]
            const qty = toQty(choices.enchantQty[key])
            return (
              <div key={key} className="flex items-center gap-3 px-5 py-3">
                <MatIcon matKey={key} />
                <span className="flex-1 text-sm text-gray-200 truncate">{m?.name}</span>
                <span className="text-gray-500 text-xs">×</span>
                <input
                  type="number"
                  min="0"
                  value={choices.enchantQty[key]}
                  onChange={e => updateChoices(c => ({ ...c, enchantQty: { ...c.enchantQty, [key]: e.target.value } }))}
                  className={inputCls}
                />
                <span className="text-yellow-400 text-sm w-28 text-right font-mono shrink-0">{formatYang(priceFn(MAT[key]) * qty)}</span>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'skills' && (
        <div className={`${panel} divide-y ${horizontal ? 'divide-white/10' : 'divide-gray-700'}`}>
          <p className="px-5 py-3 text-xs text-gray-500">{t('mount.skillsHint', { levels: SKILL_LEVELS })}</p>
          {MOUNT_SKILLS.map(skill => {
            const c = choices.skills[skill.key]
            const setSkill = patch => updateChoices(prev => ({ ...prev, skills: { ...prev.skills, [skill.key]: { ...prev.skills[skill.key], ...patch } } }))
            const books = toQty(c.books) * SKILL_LEVELS
            const skillCost = c.enabled
              ? priceFn(MAT.skillUnlocker) + books * priceFn(MAT.skillBook) + (c.reading ? books * priceFn(MAT.focusedReading) : 0)
              : 0
            return (
              <div key={skill.key} className={`flex flex-col gap-2 px-5 py-4 ${c.enabled ? '' : 'opacity-50'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={() => setSkill({ enabled: !c.enabled })}
                    className="accent-yellow-400 w-4 h-4 shrink-0"
                  />
                  <span className="flex-1 text-sm font-semibold text-gray-100">{skill.name}</span>
                  <span className="text-yellow-400 text-sm font-mono">{formatYang(skillCost)}</span>
                </label>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-6">
                  <MatChip matKey="skillUnlocker" qty={1} />
                  <span className="flex items-center gap-2">
                    <MatIcon matKey="skillBook" size="w-7 h-7" />
                    <input
                      type="number"
                      min="0"
                      value={c.books}
                      onChange={e => setSkill({ books: e.target.value })}
                      title={t('mount.booksPerLevel')}
                      className={inputCls}
                    />
                    <span className="text-xs text-gray-500">{t('mount.booksPerLevelTotal', { levels: SKILL_LEVELS, total: books })}</span>
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer" title={t('mount.readingHint')}>
                    <MatIcon matKey="focusedReading" size="w-7 h-7" />
                    <input
                      type="checkbox"
                      checked={c.reading}
                      onChange={() => setSkill({ reading: !c.reading })}
                      className="accent-yellow-400 w-4 h-4"
                    />
                    <span className="text-xs text-gray-400">{c.reading ? `×${books}` : t('mount.readingOff')}</span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isRuneTab && (
        <>
          <div className={panel}>
            <h2 className={`px-5 py-3 text-sm font-semibold text-gray-300 border-b ${horizontal ? 'border-white/10' : 'border-gray-700'}`}>
              {t('itemDetail.materialsSummaryTitle')}
            </h2>
            <div className="flex flex-col gap-2 px-5 py-4">
              {mats.length === 0 && <p className="text-sm text-gray-500 text-center py-2">{t('itemDetail.noMaterialsDefined')}</p>}
              {mats.map(([id, qty]) => materialsById[id] && (
                <MatRow
                  key={id}
                  mat={materialsById[id]}
                  quantity={qty}
                  unitPrice={priceFn(id)}
                  rawValue={rawInputs[id]}
                  onPriceChange={setPrice}
                  globalMode={mode === 'global'}
                  manualOverrides={manualOverrides}
                  onToggleManualOverride={toggleManualOverride}
                />
              ))}
              {yang > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center text-lg">💰</span>
                  <span className="flex-1 text-sm text-gray-200">{t(tab === 'level' ? 'mount.yangFees' : 'mount.upgradeFees')}</span>
                  <span className="text-yellow-400 text-sm text-right font-mono shrink-0 whitespace-nowrap">{formatYang(yang)}</span>
                </div>
              )}
            </div>
          </div>

          <StickyTotalBar sticky={stickyTotal}>
            <div className={`${horizontal ? 'bg-black/40 border border-yellow-400/20 rounded-xl' : 'bg-gray-900 border border-yellow-400/20 rounded-2xl'} px-6 py-5`}>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-semibold">{t('itemDetail.totalCost')}</span>
                <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 mt-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={stickyTotal}
                  onChange={e => setStickyTotal(e.target.checked)}
                  className="accent-yellow-400 w-3.5 h-3.5"
                />
                {t('common.stickToBottom')}
              </label>
            </div>
          </StickyTotalBar>
        </>
      )}
    </div>
  )
}
