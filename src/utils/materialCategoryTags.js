// Sorting-only category tag for materials. Never shown as a badge — only
// determines display order within the materials list (grouped, then by name).
export const CATEGORY_TAGS = [
  { value: 'ore', label: 'Ore' },
  { value: 'pearl', label: 'Pearl' },
  { value: 'material', label: 'Material' },
  { value: 'craft', label: 'Craft' },
  { value: 'monkey', label: 'Monkey' },
  { value: 'serpent', label: 'Serpent' },
  { value: 'baroness', label: 'Baroness' },
  { value: 'dt', label: 'DT' },
  { value: 'dc', label: 'DC' },
  { value: 'dragon', label: 'Dragon' },
  { value: 'jungle', label: 'Jungle' },
  { value: 'razador', label: 'Razador' },
  { value: 'nemere', label: 'Nemere' },
  { value: 'seal', label: 'Seal' },
  { value: 'scroll', label: 'Scroll' },
]

const CATEGORY_TAG_ORDER = CATEGORY_TAGS.map(t => t.value)

export function categoryTagRank(categoryTag) {
  const idx = CATEGORY_TAG_ORDER.indexOf(categoryTag)
  return idx === -1 ? CATEGORY_TAG_ORDER.length : idx
}

export function sortByCategoryTag(materials) {
  return [...materials].sort((a, b) =>
    categoryTagRank(a.category_tag) - categoryTagRank(b.category_tag) || a.name.localeCompare(b.name)
  )
}
