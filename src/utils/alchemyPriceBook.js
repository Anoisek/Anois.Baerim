import { useState } from 'react'
import { parseYang } from './formatYang'
import { db } from '../dbClient'

const RAW_KEY = 'alchemy_prices_own'
const MODE_KEY = 'alchemy_price_mode'
const COOLDOWN_KEY = 'alchemy_submit_cooldowns'
const COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6h — same per-browser cooldown as the materials global price pool

function load() {
  try { return JSON.parse(localStorage.getItem(RAW_KEY)) ?? {} } catch { return {} }
}
function loadMode() {
  return localStorage.getItem(MODE_KEY) === 'global' ? 'global' : 'own'
}
function loadCooldowns() {
  try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY)) ?? {} } catch { return {} }
}

// Parallels src/utils/priceBook.js but for the Alchemy page's flat string-keyed
// prices ('cor', or '<stone_id>:<grade>') — no recipes/items involved here, so it's
// a much smaller own-vs-global toggle than the materials one.
export function useAlchemyPriceBook() {
  const [rawInputs, setRawInputs] = useState(load)
  const [mode, setModeState] = useState(loadMode)

  function setPrice(key, raw) {
    setRawInputs(prev => {
      const next = { ...prev, [key]: raw }
      localStorage.setItem(RAW_KEY, JSON.stringify(next))
      return next
    })
  }

  function setMode(next) {
    setModeState(next)
    localStorage.setItem(MODE_KEY, next)
  }

  return { rawInputs, setPrice, mode, setMode }
}

export async function fetchAlchemyGlobalPrices() {
  const { data } = await db.from('alchemy_prices').select('key, price')
  const map = {}
  for (const row of data ?? []) map[row.key] = Number(row.price)
  return map
}

export async function submitAlchemyPriceToGlobal(key, raw) {
  const price = parseYang(raw)
  if (price === '' || !(price > 0)) return { accepted: false, skipped: true }

  const cooldowns = loadCooldowns()
  const last = cooldowns[key]
  if (last && Date.now() - last < COOLDOWN_MS) return { accepted: false, skipped: true }

  const { data, error } = await db.rpc('submit_alchemy_price', { p_key: key, p_price: price })
  if (error) return { accepted: false, skipped: false }

  cooldowns[key] = Date.now()
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns))
  return { accepted: !!data, skipped: false }
}

export function resolvePrice(key, mode, rawInputs, globalPrices) {
  if (mode === 'global') return Number(globalPrices[key] ?? 0)
  return parseYang(rawInputs[key] ?? '') || 0
}
