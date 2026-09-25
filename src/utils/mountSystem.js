// Mount system: a "Mount" subcategory doesn't list items like the other
// subcategories — it renders the MountSystem calculator instead, with its own
// set of tabs per chapter. Everything here is fixed game data, not editable
// from the admin panel.

export const MOUNT_SUBCATEGORY_NAME = 'Mount'

export function isMountSubcategory(sub) {
  return sub?.name?.trim().toLowerCase() === MOUNT_SUBCATEGORY_NAME.toLowerCase()
}

const CHAPTER_1_ID = '221f24b8-3105-4dc3-9d22-cd8312821156'
const CHAPTER_2_ID = '2750662d-2ca4-4c7c-9101-2683dd313e0e'

export const MOUNT_TABS_BY_CATEGORY = {
  [CHAPTER_1_ID]: ['level', 'bonus', 'skills'],
  [CHAPTER_2_ID]: ['runes'],
}

export const MAT = {
  horseMedal: '6b28aff9-74f1-4b3d-8c28-b024971ca88d',
  horseEmblem: '0bfc5e74-8641-4131-bfc4-fbf95fc45230',
  enchantMount1: 'd1e61f87-833f-4a8f-8b1d-3d65f0c2f885',
  enchantMount2: '0113c392-4862-4185-8734-7e1f50a194e4',
  enchantMount3: '9a8cb0ea-4bdf-4b2f-abc5-c28f7cc668fa',
  skillUnlocker: '99ac4333-5f73-44a8-bcee-9f707965f94e',
  skillBook: '2f82cd28-b9c8-4532-9ce8-830ff270fbf6',
  focusedReading: '9922c464-14d2-4cb4-9c7a-72c616c164fc',
  snakeTail: 'e6b9aa52-0fbe-4711-82c1-ee094a94d3d6',
  spiderLegs: '15069cb0-e647-4954-b52d-61cc711fba46',
}

// Levelling stages in order. "level" stages are the total consumed across the
// whole level range; "evo" stages are the evolution needed to cross into the
// next range (10→11, 20→21, 29→30).
export const LEVEL_STAGES = [
  { key: 'lvl1', kind: 'level', label: '1 → 10', mats: [['horseMedal', 20]], yang: 0 },
  { key: 'evo1', kind: 'evo', label: '10 → 11', evo: 'I', mats: [['horseMedal', 5], ['snakeTail', 1]], yang: 5_000_000 },
  { key: 'lvl2', kind: 'level', label: '11 → 20', mats: [['horseMedal', 25]], yang: 0 },
  { key: 'evo2', kind: 'evo', label: '20 → 21', evo: 'II', mats: [['horseMedal', 10], ['snakeTail', 2], ['spiderLegs', 1]], yang: 10_000_000 },
  { key: 'lvl3', kind: 'level', label: '21 → 29', mats: [['horseEmblem', 30]], yang: 0 },
  { key: 'evo3', kind: 'evo', label: '29 → 30', evo: 'III', mats: [['horseMedal', 15], ['snakeTail', 5], ['spiderLegs', 2]], yang: 25_000_000 },
]

export const BONUS_ENCHANTS = ['enchantMount1', 'enchantMount2', 'enchantMount3']
export const DEFAULT_ENCHANT_QTY = 100

export const MOUNT_SKILLS = [
  { key: 'elements', name: 'Strong against elements +5%' },
  { key: 'metins', name: 'Strong against metinstones +5%' },
  { key: 'monsters', name: 'Strong against monsters +5%' },
  { key: 'pvmCrit', name: 'PvM critical hit power +5%' },
]
export const SKILL_LEVELS = 10
export const DEFAULT_BOOKS_PER_LEVEL = 3
