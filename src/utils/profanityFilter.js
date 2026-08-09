import softWords from './profaneWordsSoft.json'

// Broad list (github.com/zautumnz/profane-words) of mild-to-strong profanity, used ONLY to
// asterisk-censor displayed comments — it never triggers the comment ban/cooldown below,
// since it also contains plenty of everyday words too mild to justify a 24h block.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const SOFT_PATTERN = new RegExp(`\\b(${softWords.map(escapeRegex).join('|')})\\b`, 'gi')

// Tolerant patterns catch common leetspeak substitutions (1/!/| for i, 4/@ for a, 3 for e, 0 for o).
// Add more patterns here if new slurs/troll words show up in comments.
const BANNED_PATTERNS = [
  // racial slur (n-word) and variants
  /n[i1!|]+g{2,}[e3]r+/gi,
  /n[i1!|]+g{2,}[a4@]/gi,
  // antisemitic slur
  /k[i1!|]k[e3]/gi,
  // slurs targeting East/Southeast Asian people
  /ch[i1!|]nk/gi,
  /g[o0]{2,}k/gi,
  // slur targeting Latino/Hispanic people
  /sp[i1!|]c/gi,
  // homophobic slur
  /f[a4@]g{2,}[o0]t/gi,
  /\bf[a4@]g\b/gi,
  // transphobic slur
  /tr[a4@]nn?y/gi,
  // ableist slur
  /r[e3]t[a4@]rd/gi,
  // severe vulgar harassment term
  /c[u0]nt/gi,
  // Polish homophobic slur
  /p[e3]d[a4@][lł]/gi,
]

export function censorText(text) {
  if (!text) return text
  let result = text
  for (const pattern of BANNED_PATTERNS) {
    result = result.replace(pattern, match => '*'.repeat(match.length))
  }
  result = result.replace(SOFT_PATTERN, match => '*'.repeat(match.length))
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
