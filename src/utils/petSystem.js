// Pet system: like the Mount system, a "Pet" subcategory doesn't list items —
// it renders the PetSystem calculator with its own set of tabs. Everything here
// is fixed game data. Potions, skill books and the Pet Unlocker are regular
// materials (own/global prices, icons editable by an admin from the Pet page).

export function isPetSubcategory(sub) {
  return sub?.name?.trim().toLowerCase() === 'pet'
}

export const PET_TABS = ['all', 'evolution', 'type', 'potions', 'skills']

export const PET_MAT = {
  petEmblem: '1caf0027-b888-4979-a053-10cd29b5eec4',
  tomeAwakening: '5ff90b32-7805-4456-be28-35f84bddd4c0',
  tomeAscension: '2567b942-cddd-4fce-a082-5639283c00d1',
  tomeTranscendence: 'cca1101d-de2e-4706-9f5f-22eaaf342df1',
  unknownTalisman: '56a0398a-1d45-4eba-9cce-6dd2bdd0311f',
  snakeTail: 'e6b9aa52-0fbe-4711-82c1-ee094a94d3d6',
  spiderLegs: '15069cb0-e647-4954-b52d-61cc711fba46',
  pearlFusion: '0ea2f050-399a-4d2b-89cb-17f4158a474a',
  fingerBones: '5ef3ec13-e555-4e20-835f-9686e3611c0d',
  waterCrystal: '9d3d7d3d-e8aa-4d07-bed3-15fd3f4b048b',
  dragonScales: '007c75e2-9677-4020-a508-210cb398ede1',
  dragonClaw: '54c40bc5-148b-43de-bcec-faca5bbb184c',
  ebony: 'a51d71b7-eca8-43dc-a0c8-8eef46bdd308',
  clam: 'ea7485e4-f216-48a3-8b74-e1aae66dfe19',
  amethyst: 'ad8c82b8-42eb-4f8f-9f40-3b275c98cccd',
  soulCrystal: 'ca867df6-6f4e-4e4e-8072-8f2a1115e19b',
  ruby: 'e40a7977-fb5f-42d4-b09b-dd04e8777449',
  fossil: 'bbaf7769-0d14-4edb-bfc2-de3859cd886c',
  symbolOfPowerPlus: 'cf5c25a5-cb16-45e8-8d5c-d7a3897bdeca',
  jungleGrimoire: 'effa8a3f-4411-408b-864a-c7f1cf2e557c',
  // Pet-only materials: potion_<group>_<size>, book_<skill>, unlocker
  potion_vitality_s: '614a625a-d10a-4e16-9c9b-7595dbcd04f2',
  potion_vitality_m: '3b802b2b-36bf-419d-99a8-33c132a40605',
  potion_vitality_l: '6cd8df17-4155-4f70-8fb7-7cfd8be9d8cb',
  potion_attack_s: '35635a43-bb49-4613-b88a-4194a95cf6dd',
  potion_attack_m: '124d13f6-317f-428a-81c2-1c1d3564ddc3',
  potion_attack_l: '1c9278bd-d9f9-48f4-b650-fff34981031c',
  potion_elemental_s: '3139466c-124f-4f60-8e82-7db6febc3ddd',
  potion_elemental_m: '13179da8-fd23-4b2f-ac2a-4b7426ebd2b1',
  potion_elemental_l: 'a0239f79-d9ae-4a97-9303-99c8eab94ba4',
  book_elementalPower: '89e18a98-8726-4547-9839-4874ad895b71',
  book_haste: 'f72bd7ba-e997-48a6-98a7-58935484977f',
  book_drill: 'be2fb1c7-88da-4b0d-9e2f-584b003c84b1',
  book_criticalMastery: 'de87aca8-1206-4ddb-902d-8c91f014515e',
  book_monsterHunter: '2549941f-7b4c-45e6-b23e-3b4a98bf98d7',
  book_humanResistance: 'c72e4468-28a0-4494-b531-15f58f565e4a',
  book_bossGuard: '5d5790f5-d18e-4d67-b985-6fc838969897',
  book_humanHunter: 'f0e030cd-090a-4d41-ae9b-9f9da8b099c0',
  book_meleeMagicBoost: 'ea566ef8-5823-46e4-be7e-fb504167b78f',
  unlocker: 'e674505b-18e1-43e3-86bf-9cbb04fe4326',
  petOrbPvp: 'f037158f-1080-40e9-9836-2a456d186824',
}

// Evolutions can't fail — every stage is paid exactly once.
export const EVOLUTIONS = [
  {
    key: 'evo1', label: '55 → 56', yang: 25_000_000,
    mats: [['tomeAwakening', 10], ['petEmblem', 10], ['unknownTalisman', 10], ['snakeTail', 5], ['spiderLegs', 10]],
  },
  {
    key: 'evo2', label: '75 → 76', yang: 100_000_000,
    mats: [['tomeAscension', 10], ['petEmblem', 15], ['pearlFusion', 10], ['fingerBones', 5], ['waterCrystal', 10]],
  },
  {
    key: 'evo3', label: '90 → 91', yang: 500_000_000,
    mats: [['tomeTranscendence', 10], ['petEmblem', 20], ['pearlFusion', 25], ['dragonScales', 10], ['dragonClaw', 10]],
  },
]

// Type upgrades 1 → 6; each step can fail (pity up to 3, every fail pays the step again).
export const TYPE_MIN = 1
export const TYPE_MAX = 6
export const TYPE_MAX_PITY = 3
export const TYPE_STEPS = [
  { type: 2, mats: [['petEmblem', 5], ['ebony', 10], ['clam', 25]] },
  { type: 3, mats: [['petEmblem', 10], ['amethyst', 10], ['pearlFusion', 5]] },
  { type: 4, mats: [['petEmblem', 15], ['soulCrystal', 10], ['pearlFusion', 10]] },
  { type: 5, mats: [['petEmblem', 20], ['ruby', 10], ['pearlFusion', 15]] },
  { type: 6, mats: [['petEmblem', 25], ['fossil', 5], ['pearlFusion', 20]] },
]

// Each potion adds +0.2% on success; S covers 0–5%, M 5–10%, L 10–15% → 25
// successes per size. The default assumes one in three potions lands (×3).
export const POTION_SUCCESSES_PER_SIZE = 25
export const POTION_DEFAULT_FACTOR = 3
export const POTION_SIZES = [
  { key: 's', label: 'S', range: '0% – 5%' },
  { key: 'm', label: 'M', range: '5% – 10%' },
  { key: 'l', label: 'L', range: '10% – 15%' },
]
export const POTION_GROUPS = [
  { key: 'vitality', label: 'Max HP', potion: 'Vitality Potion' },
  { key: 'attack', label: 'Attack PvM / PvP', potion: 'Attack Potion' },
  { key: 'elemental', label: 'Elemental Power', potion: 'Elemental Potion' },
]
export const potionKey = (group, size) => `potion_${group}_${size}`

// Skills: 6 slots, each needs one Pet Unlocker plus skill books (can fail —
// at least 20 books, 40 by default).
export const SKILL_SLOTS = 6
export const MIN_BOOKS = 20
export const DEFAULT_BOOKS = 40
export const PET_SKILLS = [
  { key: 'elementalPower', name: 'Elemental Power' },
  { key: 'haste', name: 'Haste' },
  { key: 'drill', name: 'Drill' },
  { key: 'criticalMastery', name: 'Critical Mastery' },
  { key: 'monsterHunter', name: 'Monster Hunter' },
  { key: 'humanResistance', name: 'Human Resistance' },
  { key: 'bossGuard', name: 'Boss Guard' },
  { key: 'humanHunter', name: 'Human Hunter' },
  { key: 'meleeMagicBoost', name: 'Melee Magic Boost' },
]
export const bookKey = skill => `book_${skill}`
// Pet Unlocker is a craftable material (250kk + 300 Pet Emblem + 3 Symbol of
// Power+ + 5 Jungle Grimoire) — its price comes from that recipe.
export const UNLOCKER_KEY = 'unlocker'

// Pet Orb PvP: upgrades the pet straight to type 6 (no type steps are paid) and
// raises every potion's success chance to 80%. Used by the PvP preset.
export const ORB_KEY = 'petOrbPvp'
export const ORB_DEFAULT_PRICE = 7_500_000_000 // used until the user or the global pool has a price
export const ORB_POTION_CHANCE = 0.8
export const ORB_POTION_QTY = Math.ceil(POTION_SUCCESSES_PER_SIZE / ORB_POTION_CHANCE) // 25 successes at 80% → 32
export const DEFAULT_POTION_QTY = POTION_SUCCESSES_PER_SIZE * POTION_DEFAULT_FACTOR

// Material prices with pet-specific fallbacks for materials nobody has priced yet.
export function withPetDefaults(priceFn) {
  return id => {
    const price = priceFn(id)
    return !price && id === PET_MAT[ORB_KEY] ? ORB_DEFAULT_PRICE : price
  }
}

export const PET_PRESETS = {
  pvm: {
    skills: ['monsterHunter', 'criticalMastery', 'meleeMagicBoost', 'drill', 'elementalPower', 'bossGuard'],
    potions: ['vitality', 'attack', 'elemental'],
  },
  pvp: {
    skills: ['humanResistance', 'criticalMastery', 'meleeMagicBoost', 'drill', 'humanHunter', 'haste'],
    potions: ['vitality', 'attack'],
  },
}

// ---- Choices (per user, localStorage) ----

export const PET_CHOICES_KEY = 'pet_calc_choices'

export function defaultPetChoices() {
  return {
    evolutions: Object.fromEntries(EVOLUTIONS.map(e => [e.key, true])),
    type: { owned: TYPE_MIN, pity: {}, excluded: {} },
    orb: false,
    potions: {
      groups: Object.fromEntries(POTION_GROUPS.map(g => [g.key, true])),
      qty: Object.fromEntries(POTION_GROUPS.flatMap(g => POTION_SIZES.map(s => [
        potionKey(g.key, s.key), String(POTION_SUCCESSES_PER_SIZE * POTION_DEFAULT_FACTOR),
      ]))),
    },
    skills: { slots: Array(SKILL_SLOTS).fill(null), books: Array(SKILL_SLOTS).fill(String(DEFAULT_BOOKS)) },
  }
}

export function loadPetChoices() {
  const base = defaultPetChoices()
  try {
    const saved = JSON.parse(localStorage.getItem(PET_CHOICES_KEY))
    if (!saved) return base
    return {
      evolutions: { ...base.evolutions, ...saved.evolutions },
      type: { ...base.type, ...saved.type },
      orb: saved.orb ?? false,
      potions: {
        groups: { ...base.potions.groups, ...saved.potions?.groups },
        qty: { ...base.potions.qty, ...saved.potions?.qty },
      },
      skills: {
        slots: base.skills.slots.map((_, i) => saved.skills?.slots?.[i] ?? null),
        books: base.skills.books.map((b, i) => saved.skills?.books?.[i] ?? b),
      },
    }
  } catch {
    return base
  }
}

const toQty = raw => Math.max(0, parseInt(raw) || 0)
export const booksOf = raw => Math.max(MIN_BOOKS, toQty(raw))
export const potionsOf = raw => Math.max(POTION_SUCCESSES_PER_SIZE, toQty(raw))

function addMats(acc, pairs, factor = 1) {
  for (const [key, qty] of pairs) {
    const id = PET_MAT[key]
    acc[id] = (acc[id] ?? 0) + qty * factor
  }
}

// Turning the orb on/off also re-bases every potion count: 80% success needs
// far fewer potions than the default one-in-three estimate.
export function withOrb(c, orb) {
  const qty = String(orb ? ORB_POTION_QTY : DEFAULT_POTION_QTY)
  return { ...c, orb, potions: { ...c.potions, qty: Object.fromEntries(Object.keys(c.potions.qty).map(k => [k, qty])) } }
}

// 'pvm' / 'pvp' preset applied over the user's choices (null = back to defaults).
export function applyPetPreset(c, preset) {
  if (!preset) return defaultPetChoices()
  const p = PET_PRESETS[preset]
  return withOrb({
    ...c,
    potions: { ...c.potions, groups: Object.fromEntries(POTION_GROUPS.map(g => [g.key, p.potions.includes(g.key)])) },
    skills: { ...c.skills, slots: [...p.skills] },
  }, preset === 'pvp')
}

export function typePityOf(c, type) {
  return Math.min(TYPE_MAX_PITY, Math.max(0, parseInt(c.type.pity[type]) || 0))
}

// Cost of one part ('evolution' | 'type' | 'potions' | 'skills' | 'all'):
// mats = [[materialId, qty]], yang = flat fees.
export function petPartCost(part, c) {
  const acc = {}
  let yang = 0
  if (part === 'evolution' || part === 'all') {
    for (const evo of EVOLUTIONS) {
      if (!c.evolutions[evo.key]) continue
      addMats(acc, evo.mats)
      yang += evo.yang
    }
  }
  if ((part === 'type' || part === 'all') && c.orb) {
    addMats(acc, [[ORB_KEY, 1]])
  } else if (part === 'type' || part === 'all') {
    for (const step of TYPE_STEPS) {
      if (step.type <= c.type.owned || c.type.excluded[step.type]) continue
      addMats(acc, step.mats, typePityOf(c, step.type) + 1)
    }
  }
  if (part === 'potions' || part === 'all') {
    for (const g of POTION_GROUPS) {
      if (!c.potions.groups[g.key]) continue
      for (const s of POTION_SIZES) {
        const key = potionKey(g.key, s.key)
        addMats(acc, [[key, potionsOf(c.potions.qty[key])]])
      }
    }
  }
  if (part === 'skills' || part === 'all') {
    c.skills.slots.forEach((skill, i) => {
      if (!skill) return
      addMats(acc, [[UNLOCKER_KEY, 1], [bookKey(skill), booksOf(c.skills.books[i])]])
    })
  }
  return { mats: Object.entries(acc).filter(([, q]) => q > 0), yang }
}
