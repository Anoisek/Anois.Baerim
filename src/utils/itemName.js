export const PVP_CATEGORY_ID = 'ad676ed3-18bb-44a7-9836-de9324103cf4'

// Enigma Potion upgrades from +0 to +200 in one flat fee-per-level, with the
// consumed material changing every 50 levels — too fine-grained for the normal
// +0..+9 step calculator, so its page shows only the craft/upgrade overview.
export const ENIGMA_POTION_ID = 'a760723d-7d9f-48c3-b60c-eb885e60eb52'

export function formatItemName(item) {
  if (!item) return ''
  return item.category_id === PVP_CATEGORY_ID ? `${item.name} (PvP)` : item.name
}
