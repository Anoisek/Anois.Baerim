import { useState } from 'react'
import { parseYang } from './formatYang'
import { supabase } from '../supabaseClient'

const KEY = 'material_prices'
const MODE_KEY = 'price_mode'

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

export function usePriceBook() {
  const [rawInputs, setRawInputs] = useState(load)
  const [mode, setModeState] = useState(loadMode)

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

  return { rawInputs, setPrice, importPrices, mode, setMode }
}

// recipes: { [materialId]: [{ component_id, quantity }] }
// yangCosts: { [materialId]: number } — craft yang fee, added on top of component cost
export function computePrice(materialId, rawInputs, recipes, yangCosts = {}, visited = new Set()) {
  if (visited.has(materialId)) return 0
  const recipe = recipes[materialId]
  if (recipe && recipe.length > 0) {
    const nextVisited = new Set(visited).add(materialId)
    const componentsCost = recipe.reduce((sum, row) => sum + computePrice(row.component_id, rawInputs, recipes, yangCosts, nextVisited) * row.quantity, 0)
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

export function makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts }) {
  return mode === 'global'
    ? id => computeGlobalPrice(id, globalPrices, recipes, yangCosts)
    : id => computePrice(id, rawInputs, recipes, yangCosts)
}

export async function fetchGlobalPrices() {
  const { data } = await supabase.from('global_prices').select('material_id, price')
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

// Submits every locally-entered price to the global price pool. Each submission is
// independently accepted/rejected server-side (see submit_material_price SQL function).
// A material already submitted from this browser within the last 6h is skipped —
// this only throttles this browser's own submissions, "My Own Prices" is unaffected.
export async function submitPricesToGlobal(rawInputs) {
  let accepted = 0
  let rejected = 0
  let skipped = 0
  const cooldowns = loadCooldowns()

  for (const [materialId, raw] of Object.entries(rawInputs)) {
    const price = parseYang(raw)
    if (price === '' || !(price > 0)) continue

    const last = cooldowns[materialId]
    if (last && Date.now() - last < COOLDOWN_MS) {
      skipped++
      continue
    }

    const { data, error } = await supabase.rpc('submit_material_price', { p_material_id: materialId, p_price: price })
    if (error) continue
    cooldowns[materialId] = Date.now()
    if (data) accepted++
    else rejected++
  }

  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns))
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

// rows: [{ item_id, step, yang_cost }] -> { itemId: { step: yang_cost } }
export function buildItemYangMap(rows) {
  const map = {}
  for (const row of rows ?? []) {
    if (!map[row.item_id]) map[row.item_id] = {}
    map[row.item_id][row.step] = row.yang_cost
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

// Auto price for an item used as an ingredient: materials + nested items + yang + default scroll per step, pity=1, no seals.
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

  let total = 0
  for (const step of steps) {
    let stepCost = 0
    for (const row of matSteps[step] ?? []) {
      stepCost += ctx.materialPriceFn(row.material_id) * row.quantity
    }
    for (const row of itemSteps[step] ?? []) {
      stepCost += computeItemPrice(row.component_item_id, ctx, nextVisited) * row.quantity
    }
    stepCost += yangSteps[step] ?? 0
    if (step !== 0) {
      const scrollId = ctx.defaultScrollByStep[step]
      if (scrollId) stepCost += ctx.materialPriceFn(scrollId)
    }
    total += stepCost
  }
  return total
}
