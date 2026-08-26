const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMBINING_MARKS_RE = /[̀-ͯ]/g

export function slugify(name) {
  return (name || '')
    .toString()
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .normalize('NFD').replace(COMBINING_MARKS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x'
}

export function isUuid(value) {
  return UUID_RE.test(value || '')
}

// Resolves a route param to a row: legacy UUID links keep working (matches by id),
// new pretty links match by the slugified name. Keeps old bookmarks/shares alive
// without needing a stored slug column.
export function findBySlugOrId(rows, param) {
  if (!rows || !param) return null
  if (isUuid(param)) return rows.find(r => r.id === param) ?? null
  return rows.find(r => slugify(r.name) === param) ?? null
}
