// Per-item exceptions to the normal upgrade rules (which scrolls can be used,
// whether seals apply). Every rule function takes the item as { id, category_id }.
//  - Energy Crystal: only the two "Energy" scrolls, no seals.
//  - Chapter 2 items: only the Chapter II scrolls/seals (except the Energy ones
//    and Sash Awakening Scroll, which belong to specific items).
//  - Everything else: the regular scrolls, never the Energy ones.

const ENERGY_CRYSTAL_ITEM_IDS = new Set([
  '6bdb36f4-c937-451b-8fd3-54cccb680771', // Energy Crystal (Chapter 2)
])

const CHAPTER_2_CATEGORY_ID = '2750662d-2ca4-4c7c-9101-2683dd313e0e'

const ENERGY_BLESSING_SCROLL_ID = 'a29bcdf8-beae-4c87-9f10-03ea6fe54db6'
const ENERGY_MAGIC_STONE_ID = '3f16ca2c-e15b-496a-a80f-33f1c2d532ed'
const ENERGY_SCROLL_IDS = new Set([ENERGY_BLESSING_SCROLL_ID, ENERGY_MAGIC_STONE_ID])

const SCROLL_OF_ASCENSION_ID = '578a1bf5-499c-4f7d-8f3b-b310b3b5f0f7'
const RITUAL_STONE_ID = 'a6d2300f-54f9-4b6f-b054-98e02f16fbc9'
const CHAPTER_2_SCROLL_IDS = new Set([SCROLL_OF_ASCENSION_ID, RITUAL_STONE_ID])
const CHAPTER_2_SEAL_IDS = new Set([
  '69524b9b-6736-4ee4-8c30-3f6311710e88', // Advanced Seal of Gods
  '56b8b1e8-3f3d-42b5-9b8d-30723aec6b3e', // Advanced Seal of Gods+
])

export function isEnergyItem(item) {
  return ENERGY_CRYSTAL_ITEM_IDS.has(item?.id)
}

function isChapter2Item(item) {
  return item?.category_id === CHAPTER_2_CATEGORY_ID
}

export function isEnergyScroll(materialId) {
  return ENERGY_SCROLL_IDS.has(materialId)
}

function scrollAllowed(item, scrollId) {
  if (isEnergyItem(item)) return isEnergyScroll(scrollId)
  if (isChapter2Item(item)) return CHAPTER_2_SCROLL_IDS.has(scrollId)
  return !isEnergyScroll(scrollId)
}

function sealAllowed(item, sealId) {
  if (isEnergyItem(item)) return false
  if (isChapter2Item(item)) return CHAPTER_2_SEAL_IDS.has(sealId)
  return true
}

export function scrollsForItem(item, scrolls) {
  return scrolls.filter(s => scrollAllowed(item, s.id))
}

export function sealsForItem(item, seals) {
  return seals.filter(s => sealAllowed(item, s.id))
}

// globalDefaults: the regular step → scroll map (see buildDefaultScrollMap).
export function defaultScrollsForItem(item, globalDefaults) {
  if (isEnergyItem(item)) {
    return Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(step => [step, ENERGY_MAGIC_STONE_ID]))
  }
  if (isChapter2Item(item)) {
    return Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(step => [step, step <= 4 ? SCROLL_OF_ASCENSION_ID : RITUAL_STONE_ID]))
  }
  return globalDefaults
}

// Saved per-item choices can predate these rules — a scroll that the item
// can't use any more falls back to that step's default instead.
export function sanitizeScrollChoices(item, selected, globalDefaults) {
  const defaults = defaultScrollsForItem(item, globalDefaults)
  const next = {}
  for (const [step, id] of Object.entries(selected ?? {})) {
    next[step] = !id || scrollAllowed(item, id) ? id : (defaults[step] ?? '')
  }
  return next
}

export function sanitizeSealChoices(item, selected) {
  const next = {}
  for (const [step, ids] of Object.entries(selected ?? {})) {
    next[step] = (ids ?? []).filter(id => sealAllowed(item, id))
  }
  return next
}

// One-time unlockers an item can optionally include (each is used at most once,
// independent of upgrade steps/pity). Shown as checkboxes above the step list.
const ITEM_UNLOCKERS = {
  '6bdb36f4-c937-451b-8fd3-54cccb680771': [
    'acc35b0d-21fc-4496-8b30-8e9150747e44', // Erebus Unlocker
    'a015fa32-7282-400a-ad6a-d6bef4798aa2', // Dungeon Unlocker
    '20a0b53e-39d2-4512-bb6b-e194460ffb81', // Meley Unlocker
    'e193660c-35d5-4d78-9aba-8b99697bdefa', // Average PvM Damage Unlocker
  ],
}

export function unlockersForItem(itemId) {
  return ITEM_UNLOCKERS[itemId] ?? []
}

// Selected unlocker ids from saved choices, limited to the ones this item offers.
export function selectedUnlockers(itemId, chosen) {
  const allowed = unlockersForItem(itemId)
  return (chosen ?? []).filter(id => allowed.includes(id))
}
