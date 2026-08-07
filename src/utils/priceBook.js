import { useState } from 'react'
import { parseYang } from './formatYang'

const KEY = 'material_prices'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export function usePriceBook() {
  const [rawInputs, setRawInputs] = useState(load)

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

  return { rawInputs, setPrice, importPrices }
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
      stepCost += computePrice(row.material_id, ctx.rawInputs, ctx.materialRecipes, ctx.materialYangCosts) * row.quantity
    }
    for (const row of itemSteps[step] ?? []) {
      stepCost += computeItemPrice(row.component_item_id, ctx, nextVisited) * row.quantity
    }
    stepCost += yangSteps[step] ?? 0
    if (step !== 0) {
      const scrollId = ctx.defaultScrollByStep[step]
      if (scrollId) stepCost += computePrice(scrollId, ctx.rawInputs, ctx.materialRecipes, ctx.materialYangCosts)
    }
    total += stepCost
  }
  return total
}
