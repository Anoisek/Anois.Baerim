// Server-side backstop for the client-side profanity filter (src/utils/profanityFilter.js) —
// even if someone calls the Worker's /db/map_marker_notes endpoint directly, slurs in
// comments get censored before they're stored. Ported 1:1 from the Postgres trigger
// filter_marker_note_comment (map_notes_profanity_filter_migration.sql); keep both in sync.
// One syntax change: Postgres \y (word boundary) -> JS \b.

const PATTERNS = [
  /n[i1!|]+g{2,}[e3]r+/gi,
  /n[i1!|]+g{2,}[a4@]/gi,
  /k[i1!|]k[e3]/gi,
  /ch[i1!|]nk/gi,
  /g[o0]{2,}k/gi,
  /sp[i1!|]c/gi,
  /f[a4@]g{2,}[o0]t/gi,
  /\bf[a4@]g\b/gi,
  /tr[a4@]nn?y/gi,
  /r[e3]t[a4@]rd/gi,
  /c[u0]nt/gi,
  /p[e3]d[a4@][lł]/gi,
]

function censorComment(text) {
  if (!text) return text
  let result = text
  for (const pattern of PATTERNS) {
    result = result.replace(pattern, '****')
  }
  return result
}

export { censorComment }
