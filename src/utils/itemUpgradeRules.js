// Per-item exceptions to the normal upgrade rules (which scrolls can be used,
// whether seals apply). Energy Crystal upgrades only with the two "Energy"
// scrolls and takes no seals; every other item uses the regular scrolls and
// never sees the Energy ones.

const ENERGY_CRYSTAL_ITEM_IDS = new Set([
  '6bdb36f4-c937-451b-8fd3-54cccb680771', // Energy Crystal (Chapter 2)
])

const ENERGY_BLESSING_SCROLL_ID = 'a29bcdf8-beae-4c87-9f10-03ea6fe54db6'
const ENERGY_MAGIC_STONE_ID = '3f16ca2c-e15b-496a-a80f-33f1c2d532ed'
const ENERGY_SCROLL_IDS = new Set([ENERGY_BLESSING_SCROLL_ID, ENERGY_MAGIC_STONE_ID])

export function isEnergyItem(itemId) {
  return ENERGY_CRYSTAL_ITEM_IDS.has(itemId)
}

export function isEnergyScroll(materialId) {
  return ENERGY_SCROLL_IDS.has(materialId)
}

export function scrollsForItem(itemId, scrolls) {
  return isEnergyItem(itemId)
    ? scrolls.filter(s => isEnergyScroll(s.id))
    : scrolls.filter(s => !isEnergyScroll(s.id))
}

export function sealsForItem(itemId, seals) {
  return isEnergyItem(itemId) ? [] : seals
}

// globalDefaults: the regular step → scroll map (see buildDefaultScrollMap).
export function defaultScrollsForItem(itemId, globalDefaults) {
  if (!isEnergyItem(itemId)) return globalDefaults
  return Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(step => [step, ENERGY_MAGIC_STONE_ID]))
}

// Saved per-item choices can predate these rules — a scroll that the item
// can't use any more falls back to that step's default instead.
export function sanitizeScrollChoices(itemId, selected, globalDefaults) {
  const defaults = defaultScrollsForItem(itemId, globalDefaults)
  const next = {}
  for (const [step, id] of Object.entries(selected ?? {})) {
    const allowed = !id || (isEnergyItem(itemId) ? isEnergyScroll(id) : !isEnergyScroll(id))
    next[step] = allowed ? id : (defaults[step] ?? '')
  }
  return next
}

export function sanitizeSealChoices(itemId, selected) {
  return isEnergyItem(itemId) ? {} : (selected ?? {})
}
