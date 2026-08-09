const MAX_MOKOKO = {
  'yongan': 34,
  'yayang': 35,
  'pyungmoo': 37,
  'bakra': 35,
  'joan': 41,
  'bokjung': 26,
  'seungryuon valley': 35,
  'yongbi desert': 34,
  'yongbi dessert': 34,
  'hwang temple': 20,
  'mount sohan': 32,
  'land of fire': 27,
  'spider cave': 10,
  'red wood': 26,
  'grotto of exile': 16,
  'dragon flame cape': 41,
}

export function getMaxMokoko(mapName) {
  if (!mapName) return null
  const key = mapName.trim().toLowerCase().replace(/\s+/g, ' ')
  return MAX_MOKOKO[key] ?? null
}
