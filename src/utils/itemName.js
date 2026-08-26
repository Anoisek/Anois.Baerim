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

  // Level ≤75 gear (Shoes only exempted at exactly level 75) — added per owner
  // request, no default scroll for these low-level tiers.
  '90bb629c-a739-431a-99e2-5ffca0905b17', // 46-54 Bracelets
  '36d65511-b68c-4aaf-9adc-eb91475315a4', // 46-54 Earrings
  'f92d7c50-3350-4181-87fe-2ee8b76517e6', // 46-54 Necklaces
  '700da2c4-3f77-4bed-a457-3037a072a52b', // 51-59 Shoes
  '36a2b1a0-f806-41cf-9b27-294d3c3dcd3a', // 60lvl Helmet
  '4cf0ac88-da3c-4716-8fc6-a793b472357e', // 60lvl Helmet (PvP)
  '645101b5-afe8-4397-8ee7-4bd9cc29b007', // 66-70 Armor
  'fc2047b5-e260-46f7-a3f0-d568851bdd04', // 66-70 Armor (PvP)
  '05b2355c-0ba5-435f-840c-dbc73d03392f', // 75lvl weapon
  'c2cd87c4-8334-4343-bcab-7d063abc3210', // Bracelet 55lvl (PvP)
  '0df72029-fe59-4005-9c61-de58978dd675', // Earring 55lvl (PvP)
  'cdfb771a-eb39-4a31-a60c-1248ab92c398', // Necklace 55lvl (PvP)
  'cc971224-9dab-4763-993e-f64591847e0c', // Shield 61lvl (PvP)
  'dbc28f1c-0712-4e36-ab69-cc81de06cfa7', // Shoes 55lvl (PvP)
  '30acf1f2-8058-4207-ae90-d27aa3db7912', // Weapon 65lvl (PvP)
])

export function formatItemName(item) {
  if (!item) return ''
  return item.category_id === PVP_CATEGORY_ID ? `${item.name} (PvP)` : item.name
}

// Some call sites (material/build summaries) pass items through formatItemName
// before handing them to a shared tile component, so `.name` there may already
// carry the " (PvP)" suffix. Slugs must match the DB's raw name (what ItemDetail
// resolves against), so this undoes that suffix when present.
const PVP_SUFFIX = ' (PvP)'
export function rawItemName(item) {
  if (!item) return ''
  return item.category_id === PVP_CATEGORY_ID && item.name?.endsWith(PVP_SUFFIX)
    ? item.name.slice(0, -PVP_SUFFIX.length)
    : item.name
}
