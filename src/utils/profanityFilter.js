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

export function containsBannedWord(text) {
  if (!text) return false
  return BANNED_PATTERNS.some(pattern => new RegExp(pattern.source, 'i').test(text))
}

const COOLDOWN_KEY = 'comment_cooldown_until'
const COOLDOWN_MS = 24 * 60 * 60 * 1000

export function getCooldownUntil() {
  return Number(localStorage.getItem(COOLDOWN_KEY) || 0)
}

export function startCooldown() {
  const until = Date.now() + COOLDOWN_MS
  localStorage.setItem(COOLDOWN_KEY, String(until))
  return until
}
