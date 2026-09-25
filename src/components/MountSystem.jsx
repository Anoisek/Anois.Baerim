import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { formatYang } from '../utils/formatYang'
import { slugify } from '../utils/slug'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap, fetchGlobalPrices, makeMaterialPriceFn,
} from '../utils/priceBook'
import {
  MAT, MOUNT_TABS_BY_CATEGORY, LEVEL_STAGES, BONUS_ENCHANTS, DEFAULT_ENCHANT_QTY,
  MOUNT_SKILLS, SKILL_LEVELS, DEFAULT_BOOKS_PER_LEVEL,
} from '../utils/mountSystem'
import MatRow from './MatRow'
import PriceModeToggle from './PriceModeToggle'
import StickyTotalBar, { useStickyTotal } from './StickyTotalBar'
import Spinner from './Spinner'

const STORAGE_KEY = 'mount_calc_choices'

function defaultChoices() {
  return {
    stages: Object.fromEntries(LEVEL_STAGES.map(s => [s.key, true])),
    enchantQty: Object.fromEntries(BONUS_ENCHANTS.map(k => [k, String(DEFAULT_ENCHANT_QTY)])),
    skills: Object.fromEntries(MOUNT_SKILLS.map(s => [s.key, { enabled: true, books: String(DEFAULT_BOOKS_PER_LEVEL), reading: false }])),
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
    }
  } catch {
    return base
  }
}

const toQty = raw => Math.max(0, parseInt(raw) || 0)

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
              {t(`mount.tab.${key}`)}
            </button>
          ))}
        </div>
        {tab !== 'runes' && <PriceModeToggle mode={mode} setMode={setMode} horizontal={horizontal} />}
      </div>

      {tab === 'runes' && (
        <div className={`${panel} flex flex-col items-center py-16 text-gray-500 gap-3`}>
          <span className="text-5xl">🚧</span>
          <p className="text-sm">{t('mount.comingSoon')}</p>
        </div>
      )}

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

      {tab !== 'runes' && (
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
                  <span className="flex-1 text-sm text-gray-200">{t('mount.yangFees')}</span>
                  <span className="text-yellow-400 text-sm w-24 text-right font-mono shrink-0">{formatYang(yang)}</span>
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
