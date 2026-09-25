// Mount system: a "Mount" subcategory doesn't list items like the other
// subcategories — it renders the MountSystem calculator instead, with its own
// set of tabs per chapter. Everything here is fixed game data, not editable
// from the admin panel.

const MOUNT_SUBCATEGORY_NAMES = ['mount', 'mount runes']

export function isMountSubcategory(sub) {
  return MOUNT_SUBCATEGORY_NAMES.includes(sub?.name?.trim().toLowerCase())
}

const CHAPTER_1_ID = '221f24b8-3105-4dc3-9d22-cd8312821156'
const CHAPTER_2_ID = '2750662d-2ca4-4c7c-9101-2683dd313e0e'

export const MOUNT_TABS_BY_CATEGORY = {
  [CHAPTER_1_ID]: ['level', 'bonus', 'skills'],
  [CHAPTER_2_ID]: ['all', 'ochao', 'erebus', 'meley', 'metin'],
}

export const MAT = {
  horseMedal: '0238801e-d0d2-4e49-95ba-5261185761a2',
  horseEmblem: '89a0cbe3-4d9a-4e52-9d6f-2cbadd1e00af',
  enchantMount1: '3c0d360b-176c-4f1f-86dd-e594d6b5cc55',
  enchantMount2: 'b0955d69-5570-4ac7-86ef-e06774858000',
  enchantMount3: 'b7f7d9ab-9ac7-4051-970b-f7cf13ede5ee',
  skillUnlocker: '21e95fb7-8d0f-4aa6-9b04-0d73f0939a91',
  skillBook: 'fbb7e775-de1a-496f-a215-198726202a8b',
  focusedReading: '38acac05-c80c-4806-9e4b-cc757dd70318',
  snakeTail: 'e6b9aa52-0fbe-4711-82c1-ee094a94d3d6',
  spiderLegs: '15069cb0-e647-4954-b52d-61cc711fba46',
  energyFragment: 'f1c388db-8c62-4640-b538-94db0a07aafe',
  nobleEpaulette: '4a587bd3-a2fe-4698-8be2-a99ce3bc881c',
  dragonSkull: '2bec9f1c-c581-4432-ab58-f1cd2a6cd782',
  jungleGrimoire: 'effa8a3f-4411-408b-864a-c7f1cf2e557c',
  anvil: '478cec4c-4e1b-4a37-9e0d-c6295d491220',
  symbolOfPower: 'cf5c25a5-cb16-45e8-8d5c-d7a3897bdeca',
  mythril: '6ab9b012-9118-4d98-8203-c3e104d43a07',
  moonstone: '07b324ab-92c5-4ed5-a48e-48fd4e1303f7',
  sturdyCords: '206bb515-2663-49ec-bc4c-f982e494e1e8',
  ochaoHorn: '777bb6e5-b7d0-405d-a179-85b944ec06ba',
  goldDye: 'fb846710-d267-4e0f-a6e1-33f978a30358',
  titaniumDioxide: 'f6953b46-4db8-45dd-b523-d1e45fd69afd',
  soulOfTruth: 'eaa6ba35-7a4d-4072-8f73-b07aae8b1ea3',
  dragonWings: 'aa2e4504-e2f4-4327-9827-8af4f32b2c0c',
  agate: '98730a53-ae4c-4d3f-82ed-cfa3a6045785',
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

// Mount runes (Chapter 2): upgraded +0 → +10 like items, but with no craft,
// no scrolls/seals, and every step capped at pity 3.
export const RUNE_STEPS = 10
export const RUNE_MAX_PITY = 3

// Per-rune material rows: [matKey, [qty for step 1..10]] — null = not used on that step.
const _ = null
const EMBLEMS = ['horseEmblem', [1, 2, 2, 3, 4, 4, 5, 5, 5, 5]]
const HORN_5_10 = ['ochaoHorn', [_, _, _, _, 1, 2, 3, 3, 4, 5]]
const YANG_B = [100, 125, 150, 175, 200, 225, 250, 300, 325, 350].map(kk => kk * 1_000_000)

const IMG = 'https://baerim-images-worker.bartoszlisowiec.workers.dev/images/'

export const RUNES = [
  {
    key: 'ochao',
    name: 'Ochao Rune',
    image: IMG + '1790378565958-rune-ochao.png',
    rows: [
      EMBLEMS,
      ['energyFragment', [200, 250, 300, 350, 400, 450, 500, 500, 500, 500]],
      ['nobleEpaulette', [2, 2, 3, 3, 3, 4, 5, 5, 5, 5]],
      ['dragonSkull', [2, 3, 4, 5, _, _, _, _, _, _]],
      ['jungleGrimoire', [_, _, _, _, 2, 3, 3, 4, 5, 5]],
      ['anvil', [1, 1, 2, 2, 3, 5, _, _, _, _]],
      ['symbolOfPower', [_, _, _, _, _, _, 3, 4, 5, 5]],
    ],
    yang: [100, 125, 150, 175, 200, 225, 250, 275, 300, 350].map(kk => kk * 1_000_000),
  },
  {
    key: 'erebus',
    name: 'Erebus Rune',
    image: IMG + '1790378569128-rune-erebus.png',
    rows: [
      EMBLEMS,
      ['mythril', [25, 50, 75, 100, 125, 150, 175, 200, 225, 250]],
      ['moonstone', [_, 1, 2, 2, 3, 3, 4, 4, 5, 5]],
      ['sturdyCords', [_, _, _, _, 1, 2, 3, 3, 4, 5]],
      HORN_5_10,
    ],
    yang: YANG_B,
  },
  {
    key: 'meley',
    name: 'Meley Rune',
    image: IMG + '1790378572057-rune-meley.png',
    rows: [
      EMBLEMS,
      ['mythril', [40, 60, 80, 100, 120, 150, 175, 200, 225, 250]],
      ['goldDye', [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]],
      ['moonstone', [1, 2, 3, 4, _, _, _, _, _, _]],
      ['titaniumDioxide', [_, _, _, _, 1, 2, 3, 3, 4, 5]],
      HORN_5_10,
    ],
    yang: YANG_B,
  },
  {
    key: 'metin',
    name: 'Metin Rune',
    image: IMG + '1790378574954-rune-metin.png',
    rows: [
      EMBLEMS,
      ['mythril', [80, 100, 120, 100, _, _, _, _, _, _]],
      ['soulOfTruth', [_, _, _, _, 1, 2, 3, 3, 4, 5]],
      ['goldDye', [2, 2, 3, 3, _, _, _, _, _, _]],
      ['dragonWings', [_, _, _, _, 1, 2, 3, 3, 1, 5]],
      ['agate', [1, 1, 2, 2, _, _, _, _, _, _]],
      ['titaniumDioxide', [_, _, _, _, 1, 2, 3, 3, 4, 5]],
      HORN_5_10,
    ],
    yang: YANG_B,
  },
]

// [[matKey, qty], ...] for one rune step (1-based).
export function runeStepMats(rune, step) {
  return rune.rows.filter(([, qtys]) => qtys[step - 1] != null).map(([key, qtys]) => [key, qtys[step - 1]])
}
