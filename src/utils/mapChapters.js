// Interactive map sidebar groups. maps.chapter holds the id (1 or 2).
export const MAP_CHAPTERS = [
  { id: 1, name: 'Chapter I' },
  { id: 2, name: 'Chapter II' },
]

export const mapChapterOf = map => (map?.chapter === 2 ? 2 : 1)
