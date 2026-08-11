export const PVP_CATEGORY_ID = 'ad676ed3-18bb-44a7-9836-de9324103cf4'

// Enigma Potion upgrades from +0 to +200 in one flat fee-per-level, with the
// consumed material changing every 50 levels — too fine-grained for the normal
// +0..+9 step calculator, so its page shows only the craft/upgrade overview.
export const ENIGMA_POTION_ID = 'a760723d-7d9f-48c3-b60c-eb885e60eb52'

// Items whose upgrade path never uses Scroll of War / Magic Stone, so the page
// shouldn't auto-select one on first visit like it does for every other item.
export const NO_DEFAULT_SCROLL_ITEM_IDS = new Set([
  ENIGMA_POTION_ID,
  'a52ce90c-e607-44a6-93ea-6773bd1ce704', // Fishing Pole
  '39b53379-fd6c-44e2-b6e7-7995167ba3d6', // Pickaxe
])

export function formatItemName(item) {
  if (!item) return ''
  return item.category_id === PVP_CATEGORY_ID ? `${item.name} (PvP)` : item.name
}
