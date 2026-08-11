export const PVP_CATEGORY_ID = 'ad676ed3-18bb-44a7-9836-de9324103cf4'

export function formatItemName(item) {
  if (!item) return ''
  return item.category_id === PVP_CATEGORY_ID ? `${item.name} (PvP)` : item.name
}
