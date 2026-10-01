import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import SealPicker from './SealPicker'
import { formatYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import { formatItemName, PVP_CATEGORY_ID, NO_DEFAULT_SCROLL_ITEM_IDS } from '../utils/itemName'
import { slugify } from '../utils/slug'
import { computeItemPrice } from '../utils/priceBook'
import {
  scrollsForItem, sealsForItem, defaultScrollsForItem, sanitizeScrollChoices, persistableScrollChoices,
  isUnlimitedPityScroll, sanitizeSealChoices, unlockersForItem, selectedUnlockers,
} from '../utils/itemUpgradeRules'

// Same order as the scroll dropdown on the item page.
const SCROLL_ORDER = [
  'Blessing Scroll', 'Dragon Scroll', 'Scroll of Honor',
  'Blacksmith Handbook', 'Scroll of War', 'Magic Stone',
  'Scroll of Ascension', 'Ritual Stone',
]
const scrollRank = s => {
  const i = SCROLL_ORDER.findIndex(n => s.name.toLowerCase().includes(n.toLowerCase()))
  return i === -1 ? 999 : i
}

function excludedStepsForOwnedLevel(level) {
  if (level === '-') return {}
  const excluded = {}
  for (let s = 0; s <= Number(level); s++) excluded[s] = true
  return excluded
}

// Choices exactly as the item page loads them from localStorage (or its defaults).
function loadChoices(item, defaultScrollByStep) {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(`item_choices_${item.id}`)) } catch { /* corrupt entry → defaults */ }
  if (saved) {
    return {
      selectedScroll: NO_DEFAULT_SCROLL_ITEM_IDS.has(item.id) ? {} : sanitizeScrollChoices(item, saved.selectedScroll, defaultScrollByStep),
      selectedSeals: sanitizeSealChoices(item, saved.selectedSeals),
      unlockers: selectedUnlockers(item.id, saved.unlockers),
      pity: saved.pity ?? {},
      ownedLevel: saved.ownedLevel ?? (saved.includeCraft === false ? '0' : '-'),
      variantByStep: saved.variantByStep ?? {},
    }
  }
  const defaults = NO_DEFAULT_SCROLL_ITEM_IDS.has(item.id) ? {} : defaultScrollsForItem(item, defaultScrollByStep)
  return {
    selectedScroll: Object.fromEntries(Object.entries(defaults).map(([step, id]) => [step, id ?? ''])),
    selectedSeals: {},
    unlockers: [],
    pity: {},
    ownedLevel: '-',
    variantByStep: {},
  }
}

// Compact version of the item calculator (+0 → +9) shown over the Build Calculator:
// owned level, scroll / seals / pity per step. Saves to the same localStorage entry
// as the item page, so both stay in sync.
export default function QuickItemCalc({ item, ctx, materialsById, pityMode, onPityModeChange, onChange, onClose, horizontal }) {
  const { t } = useTranslation()
  const [choices, setChoices] = useState(() => loadChoices(item, ctx.defaultScrollByStep))

  function update(patch) {
    const next = { ...choices, ...patch }
    setChoices(next)
    try {
      localStorage.setItem(`item_choices_${item.id}`, JSON.stringify({
        selectedScroll: persistableScrollChoices(item, next.selectedScroll, ctx.defaultScrollByStep),
        selectedSeals: next.selectedSeals,
        pity: next.pity,
        includeCraft: next.ownedLevel === '-',
        excludedSteps: excludedStepsForOwnedLevel(next.ownedLevel),
        ownedLevel: next.ownedLevel,
        variantByStep: next.variantByStep,
        unlockers: next.unlockers,
      }))
    } catch { /* storage unavailable */ }
    onChange()
  }

  const allMats = Object.values(materialsById)
  const scrolls = scrollsForItem(item, allMats.filter(m => m.is_upgrade_scroll)).sort((a, b) => scrollRank(a) - scrollRank(b))
  const seals = sealsForItem(item, allMats.filter(m => m.is_seal)).sort((a, b) => a.name.localeCompare(b.name))
  const unlockerMats = unlockersForItem(item.id).map(id => materialsById[id]).filter(Boolean)

  const matSteps = ctx.itemMaterials[item.id] ?? {}
  const itemSteps = ctx.itemItems[item.id] ?? {}
  const yangSteps = ctx.itemYang[item.id] ?? {}
  const steps = [...new Set([matSteps, itemSteps, yangSteps].flatMap(m => Object.keys(m).map(Number)))].sort((a, b) => a - b)

  let variantCount = 1
  for (const rows of [...Object.values(matSteps), ...Object.values(itemSteps)]) for (const r of rows) variantCount = Math.max(variantCount, r.variant ?? 1)
  for (const variants of Object.values(yangSteps)) for (const v of Object.keys(variants)) variantCount = Math.max(variantCount, Number(v))
  const isPvp = item.category_id === PVP_CATEGORY_ID
  const variantOf = step => (isPvp ? (choices.variantByStep[step] ?? 1) : 1)
  const currentVariant = steps.length ? variantOf(steps[0]) : 1

  function cycleVariant() {
    const next = currentVariant >= variantCount ? 1 : currentVariant + 1
    update({ variantByStep: Object.fromEntries(steps.map(s => [s, next])) })
  }

  const maxPityOf = step => (isUnlimitedPityScroll(item, choices.selectedScroll[step]) ? null : ctx.itemMaxPity?.[item.id]?.[step]?.[variantOf(step)] ?? null)
  function pityOf(step) {
    const max = maxPityOf(step)
    const val = Math.max(0, parseInt(choices.pity[step]) || 0)
    return max != null ? Math.min(val, max) : val
  }
  function setPity(step, raw) {
    const max = maxPityOf(step)
    update({ pity: { ...choices.pity, [step]: max != null && Number(raw) > max ? String(max) : raw } })
  }

  const price = id => ctx.materialPriceFn(id)
  function stepCost(step) {
    const v = variantOf(step)
    let cost = yangSteps[step]?.[v] ?? 0
    for (const r of (matSteps[step] ?? []).filter(r => (r.variant ?? 1) === v)) cost += price(r.material_id) * r.quantity
    for (const r of (itemSteps[step] ?? []).filter(r => (r.variant ?? 1) === v)) cost += computeItemPrice(r.component_item_id, ctx) * r.quantity
    if (step !== 0) {
      if (choices.selectedScroll[step]) cost += price(choices.selectedScroll[step])
      for (const id of choices.selectedSeals[step] ?? []) cost += price(id)
    }
    return cost * (pityOf(step) + 1)
  }

  const owned = excludedStepsForOwnedLevel(choices.ownedLevel)
  const total = steps.reduce((sum, s) => (owned[s] ? sum : sum + stepCost(s)), 0)
    + choices.unlockers.reduce((sum, id) => sum + price(id), 0)

  const field = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-600'
  const row = horizontal ? 'border-white/10 bg-black/20' : 'border-gray-700 bg-gray-800/40'

  return (
    <Modal title={formatItemName(item)} onClose={onClose} maxWidthClass="max-w-2xl" horizontal={horizontal}>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="w-10 h-10 shrink-0 flex items-center justify-center">
          {itemImages(item)[0] && <img src={itemImages(item)[0]} alt="" className="max-w-full max-h-full object-contain" />}
        </div>
        {steps.length > 0 && (
          <select
            value={choices.ownedLevel}
            onChange={e => update({ ownedLevel: e.target.value })}
            title={t('itemDetail.ownedLevelTooltip')}
            className={`border rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-yellow-400 ${field}`}
          >
            <option value="-">-</option>
            {Array.from({ length: 10 }, (_, n) => <option key={n} value={String(n)}>+{n}</option>)}
          </select>
        )}
        {isPvp && variantCount > 1 && (
          <button
            type="button"
            onClick={cycleVariant}
            className="bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {t('itemDetail.variant', { current: currentVariant, count: variantCount })}
          </button>
        )}
        <Link
          to={`/chapter/${item.category_id}/item/${slugify(item.name)}`}
          className="ml-auto text-xs font-semibold text-gray-400 hover:text-yellow-400 transition-colors"
        >
          {t('buildCalculator.openFullCalc')}
        </Link>
      </div>

      {pityMode && (
        <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-yellow-200">
            {t('buildCalculator.pityOverrideActive', { mode: t(pityMode === 'zero' ? 'buildCalculator.pityZero' : 'buildCalculator.pityMax') })}
          </span>
          <button type="button" onClick={() => onPityModeChange(null)} className="text-xs font-semibold text-yellow-300 hover:text-yellow-100 underline">
            {t('buildCalculator.turnOff')}
          </button>
        </div>
      )}

      {unlockerMats.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {unlockerMats.map(mat => (
            <label key={mat.id} className={`flex items-center gap-2 border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 cursor-pointer ${row}`}>
              <input
                type="checkbox"
                checked={choices.unlockers.includes(mat.id)}
                onChange={() => update({ unlockers: choices.unlockers.includes(mat.id) ? choices.unlockers.filter(x => x !== mat.id) : [...choices.unlockers, mat.id] })}
                className="accent-yellow-400"
              />
              {mat.image_url && <img src={mat.image_url} alt="" className="w-5 h-5 object-contain" />}
              {mat.name}
            </label>
          ))}
        </div>
      )}

      {steps.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">{t('itemDetail.noMaterialsDefined')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {steps.map(step => {
            const isOwned = !!owned[step]
            const max = maxPityOf(step)
            return (
              <div key={step} className={`flex items-center gap-2 flex-wrap border rounded-lg px-3 py-1.5 ${row} ${isOwned ? 'opacity-40' : ''}`}>
                <span className="w-20 shrink-0 text-xs font-bold text-yellow-400">{t(`itemDetail.step${step}`)}</span>
                {!isOwned && step !== 0 && scrolls.length > 0 && (
                  <select
                    value={choices.selectedScroll[step] ?? ''}
                    onChange={e => update({ selectedScroll: { ...choices.selectedScroll, [step]: e.target.value } })}
                    className={`border rounded-lg px-1.5 py-1 text-xs text-white max-w-44 focus:outline-none focus:border-yellow-400 ${field}`}
                  >
                    <option value="">{t('itemDetail.noScroll')}</option>
                    {scrolls.map(s => <option key={s.id} value={s.id}>{s.name.toLowerCase().includes('magic stone') ? `⭐ ${s.name}` : s.name}</option>)}
                  </select>
                )}
                {!isOwned && step !== 0 && seals.length > 0 && (
                  <SealPicker
                    seals={seals}
                    selected={choices.selectedSeals[step] ?? []}
                    onChange={val => update({ selectedSeals: { ...choices.selectedSeals, [step]: val } })}
                  />
                )}
                {!isOwned && max !== 0 && (
                  <label className="flex items-center gap-1 text-xs text-gray-400" title={max != null ? t('itemDetail.pityMax', { max }) : t('itemDetail.pity')}>
                    {t('itemDetail.pity')}
                    <input
                      type="number"
                      min="0"
                      max={max ?? undefined}
                      value={pityOf(step)}
                      onChange={e => setPity(step, e.target.value)}
                      className={`border rounded-lg px-1.5 py-1 w-12 text-center text-xs text-white focus:outline-none focus:border-yellow-400 ${field}`}
                    />
                    {max != null && <span className="text-gray-500">/{max}</span>}
                  </label>
                )}
                <span className={`ml-auto text-xs font-mono ${isOwned ? 'text-gray-500 line-through' : 'text-yellow-400'}`}>{formatYang(stepCost(step))}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className={`mt-3 border rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 ${row}`}>
        <span className="text-sm text-gray-300 font-semibold">{t('itemDetail.totalCost')}</span>
        <span className="text-lg font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
      </div>
    </Modal>
  )
}
