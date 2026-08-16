import { useState } from 'react'
import { parseYang } from './formatYang'
import { db } from '../dbClient'

const KEY = 'material_prices'
const MODE_KEY = 'price_mode'
const MANUAL_OVERRIDE_KEY = 'manual_price_materials'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

function loadMode() {
  return localStorage.getItem(MODE_KEY) === 'global' ? 'global' : 'own'
}

function loadManualOverrides() {
  try {
    return new Set(JSON.parse(localStorage.getItem(MANUAL_OVERRIDE_KEY)) ?? [])
  } catch {
    return new Set()
  }
}

export function usePriceBook() {
  const [rawInputs, setRawInputs] = useState(load)
  const [mode, setModeState] = useState(loadMode)
  const [manualOverrides, setManualOverrides] = useState(loadManualOverrides)

  function setPrice(materialId, raw) {
    setRawInputs(prev => {
      const next = { ...prev, [materialId]: raw }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  function importPrices(imported) {
    setRawInputs(prev => {
      const next = { ...prev, ...imported }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  function setMode(next) {
    setModeState(next)
    localStorage.setItem(MODE_KEY, next)
  }

  // Lets a craftable material's price be typed in by hand instead of always
  // being auto-computed from its recipe — some recipes don't reflect reality
  // well enough (missing ingredients, NPC-only steps, etc).
  function toggleManualOverride(materialId) {
    setManualOverrides(prev => {
      const next = new Set(prev)
      if (next.has(materialId)) next.delete(materialId)
      else next.add(materialId)
      localStorage.setItem(MANUAL_OVERRIDE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return { rawInputs, setPrice, importPrices, mode, setMode, manualOverrides, toggleManualOverride }
}

// recipes: { [materialId]: [{ component_id, quantity }] }
// yangCosts: { [materialId]: number } — craft yang fee, added on top of component cost
// manualOverrides: Set<materialId> — materials whose price is typed in by hand even
// though they have a recipe (see usePriceBook's toggleManualOverride)
export function computePrice(materialId, rawInputs, recipes, yangCosts = {}, visited = new Set(), manualOverrides = null) {
  if (visited.has(materialId)) return 0
  const recipe = recipes[materialId]
  if (recipe && recipe.length > 0 && !manualOverrides?.has(materialId)) {
    const nextVisited = new Set(visited).add(materialId)
    const componentsCost = recipe.reduce((sum, row) => sum + computePrice(row.component_id, rawInputs, recipes, yangCosts, nextVisited, manualOverrides) * row.quantity, 0)
    return componentsCost + (yangCosts[materialId] || 0)
  }
  return parseYang(rawInputs[materialId] ?? '') || 0
}

// Global-prices mode: a directly submitted community price wins; the recipe is
// only used as a fallback when no one has submitted a price for that material yet.
export function computeGlobalPrice(materialId, globalPrices, recipes, yangCosts = {}, visited = new Set()) {
  if (visited.has(materialId)) return 0
  const direct = Number(globalPrices[materialId] ?? 0)
  if (direct > 0) return direct
  const recipe = recipes[materialId]
  if (recipe && recipe.length > 0) {
    const nextVisited = new Set(visited).add(materialId)
    const componentsCost = recipe.reduce((sum, row) => sum + computeGlobalPrice(row.component_id, globalPrices, recipes, yangCosts, nextVisited) * row.quantity, 0)
    return componentsCost + (yangCosts[materialId] || 0)
  }
  return 0
}

export function makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts, manualOverrides }) {
  return mode === 'global'
    ? id => computeGlobalPrice(id, globalPrices, recipes, yangCosts)
    : id => computePrice(id, rawInputs, recipes, yangCosts, new Set(), manualOverrides)
}

export async function fetchGlobalPrices() {
  const { data } = await db.from('global_prices').select('material_id, price')
  const map = {}
  for (const row of data ?? []) map[row.material_id] = Number(row.price)
  return map
}

const COOLDOWN_KEY = 'global_submit_cooldowns'
const COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6h — one global-price submission per material per browser

function loadCooldowns() {
  try {
    return JSON.parse(localStorage.getItem(COOLDOWN_KEY)) ?? {}
  } catch {
    return {}
  }
}

// Submits one material's locally-entered price to the global price pool.
// Server-side accept/reject is independent of this (see submit_material_price SQL
// function) — this only enforces the per-browser 6h cooldown before even trying.
// Used both by the bulk "Submit to global prices" button and by the automatic
// submit-on-blur in MaterialPriceCell (most users never click that button).
export async function submitPriceToGlobal(materialId, raw) {
  const price = parseYang(raw)
  if (price === '' || !(price > 0)) return { accepted: false, skipped: true }

  const cooldowns = loadCooldowns()
  const last = cooldowns[materialId]
  if (last && Date.now() - last < COOLDOWN_MS) return { accepted: false, skipped: true }

  const { data, error } = await db.rpc('submit_material_price', { p_material_id: materialId, p_price: price })
  if (error) return { accepted: false, skipped: false }

  cooldowns[materialId] = Date.now()
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns))
  return { accepted: !!data, skipped: false }
}

// Submits every locally-entered price to the global price pool. Each submission is
// independently accepted/rejected server-side (see submit_material_price SQL function).
// A material already submitted from this browser within the last 6h is skipped —
// this only throttles this browser's own submissions, "My Own Prices" is unaffected.
export async function submitPricesToGlobal(rawInputs) {
  let accepted = 0
  let rejected = 0
  let skipped = 0

  for (const [materialId, raw] of Object.entries(rawInputs)) {
    const result = await submitPriceToGlobal(materialId, raw)
    if (result.skipped) { if (parseYang(raw) > 0) skipped++; continue }
    if (result.accepted) accepted++
    else rejected++
  }

  return { accepted, rejected, skipped }
}

export function buildRecipeMap(rows) {
  const map = {}
  for (const row of rows ?? []) {
    if (!map[row.material_id]) map[row.material_id] = []
    map[row.material_id].push(row)
  }
  return map
}

export function buildYangCostMap(materials) {
  const map = {}
  for (const m of materials ?? []) {
    if (m.craft_yang_cost) map[m.id] = Number(m.craft_yang_cost)
  }
  return map
}

// rows: [{ item_id, step, ... }] -> { itemId: { step: [rows] } }
export function buildItemStepMap(rows) {
  const map = {}
  for (const row of rows ?? []) {
    if (!map[row.item_id]) map[row.item_id] = {}
    if (!map[row.item_id][row.step]) map[row.item_id][row.step] = []
    map[row.item_id][row.step].push(row)
  }
  return map
}

// rows: [{ item_id, step, variant, yang_cost }] -> { itemId: { step: { variant: yang_cost } } }
export function buildItemYangMap(rows) {
  const map = {}
  for (const row of rows ?? []) {
    if (!map[row.item_id]) map[row.item_id] = {}
    if (!map[row.item_id][row.step]) map[row.item_id][row.step] = {}
    map[row.item_id][row.step][row.variant ?? 1] = row.yang_cost
  }
  return map
}

// rows: [{ item_id, step, variant, max_pity }] -> { itemId: { step: { variant: max_pity } } }
// max_pity is the highest pity value selectable (0-based: pity 0 = ×1 materials).
// 0 is a meaningful cap (always ×1) and must not be treated the same as "no cap".
// Craft (step 0) is a single deterministic action, not a chance-based upgrade — it
// defaults to max_pity 0 (no bonus) when nobody set one explicitly.
export function buildItemMaxPityMap(rows) {
  const map = {}
  for (const row of rows ?? []) {
    const maxPity = row.max_pity ?? (row.step === 0 ? 0 : null)
    if (maxPity == null) continue
    if (!map[row.item_id]) map[row.item_id] = {}
    if (!map[row.item_id][row.step]) map[row.item_id][row.step] = {}
    map[row.item_id][row.step][row.variant ?? 1] = maxPity
  }
  return map
}

// Mirrors ItemDetail's default scroll auto-selection (Scroll of War for +0..+4, Magic Stone for +4..+9)
export function buildDefaultScrollMap(scrollMaterials) {
  const war = (scrollMaterials ?? []).find(s => s.name.toLowerCase().includes('scroll of war'))
  const magic = (scrollMaterials ?? []).find(s => s.name.toLowerCase().includes('magic stone'))
  return {
    1: war?.id, 2: war?.id, 3: war?.id, 4: war?.id,
    5: magic?.id, 6: magic?.id, 7: magic?.id, 8: magic?.id, 9: magic?.id,
  }
}

function loadItemChoices(itemId) {
  try {
    const raw = localStorage.getItem(`item_choices_${itemId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Price for an item used as an ingredient: materials + nested items + yang, using
// whatever scroll/seal/pity/include-craft choices the user already saved on that
// item's own page (item_choices_<id> in localStorage). Falls back to the default
// scroll auto-selection, pity=0 (×1 materials), no seals, craft included — only if
// the item was never opened/configured, matching what its page would show on first visit.
// ctx.materialPriceFn: (materialId) => number — supplied by the caller, own- or global-mode aware.
export function computeItemPrice(itemId, ctx, visited = new Set()) {
  if (visited.has(itemId)) return 0
  const nextVisited = new Set(visited).add(itemId)

  const matSteps = ctx.itemMaterials[itemId] ?? {}
  const itemSteps = ctx.itemItems[itemId] ?? {}
  const yangSteps = ctx.itemYang[itemId] ?? {}

  const steps = new Set([
    ...Object.keys(matSteps).map(Number),
    ...Object.keys(itemSteps).map(Number),
    ...Object.keys(yangSteps).map(Number),
  ])

  const choices = loadItemChoices(itemId)
  const includeCraft = choices?.includeCraft ?? true
  const excludedSteps = choices?.excludedSteps ?? {}

  let total = 0
  for (const step of steps) {
    if (step === 0 && !includeCraft) continue
    if (excludedSteps[step]) continue

    const variant = choices?.variantByStep?.[step] ?? 1

    let stepCost = 0
    for (const row of (matSteps[step] ?? []).filter(r => (r.variant ?? 1) === variant)) {
      stepCost += ctx.materialPriceFn(row.material_id) * row.quantity
    }
    for (const row of (itemSteps[step] ?? []).filter(r => (r.variant ?? 1) === variant)) {
      stepCost += computeItemPrice(row.component_item_id, ctx, nextVisited) * row.quantity
    }
    stepCost += yangSteps[step]?.[variant] ?? 0

    if (step !== 0) {
      const scrollId = choices ? (choices.selectedScroll?.[step] ?? '') : ctx.defaultScrollByStep[step]
      if (scrollId) stepCost += ctx.materialPriceFn(scrollId)

      const sealIds = choices?.selectedSeals?.[step] ?? []
      for (const sealId of sealIds) stepCost += ctx.materialPriceFn(sealId)
    }

    let pityInput = choices ? Math.max(0, parseInt(choices.pity?.[step]) || 0) : 0
    const maxPity = ctx.itemMaxPity?.[itemId]?.[step]?.[variant]
    if (maxPity != null) pityInput = Math.min(pityInput, maxPity)
    stepCost *= pityInput + 1

    total += stepCost
  }
  return total
}
