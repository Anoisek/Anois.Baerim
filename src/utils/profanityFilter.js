// Tolerant patterns catch common leetspeak substitutions (1/!/| for i, 4/@ for a, 3 for e).
// Add more patterns here if new slurs show up in comments.
const BANNED_PATTERNS = [
  /n[i1!|]+g{2,}[e3]r+/gi,
  /n[i1!|]+g{2,}[a4@]/gi,
]

export function censorText(text) {
  if (!text) return text
  let result = text
  for (const pattern of BANNED_PATTERNS) {
    result = result.replace(pattern, match => '*'.repeat(match.length))
  }
  return result
}
