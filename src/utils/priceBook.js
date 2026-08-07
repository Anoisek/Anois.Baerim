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
