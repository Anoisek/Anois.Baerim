// One-time transfer of this browser's local data (nickname, collected mokoko markers,
// prices, ui prefs, etc.) from an old domain to the current one. localStorage is
// per-origin, so a plain DNS/host swap would leave everyone's saved progress behind —
// this carries it across via a signed-free redirect + query payload.

// Order matters here: pages.dev was the live site for ~12 days right up until this
// switch, vercel.app is a frozen snapshot from before that. When both are consulted
// at once (requestManualRecovery), earlier entries win for any key both hold.
const OLD_HOSTS = ['anois-baerim.pages.dev', 'anois-baerim.vercel.app']
const NEW_ORIGIN = 'https://baerimtools.com'
const MIGRATE_PARAM = 'migrate'

const STATIC_KEYS = [
  'metin_nickname',
  'map_collected_markers',
  'material_prices',
  'price_mode',
  'global_submit_cooldowns',
  'comment_cooldown_until',
  'site_lang',
  'night_mode',
  'build_calculator_list',
  'ui_scale',
  'liked_notes',
  'mokoko_all_collected_seen',
  'csCatalogOverrides_v1',
]

const DYNAMIC_PREFIXES = ['item_choices_', 'metin_loot_']

function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

function fromBase64(b64) {
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function collectPayload() {
  const data = {}
  for (const key of STATIC_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null) data[key] = value
  }
  for (const key of Object.keys(localStorage)) {
    if (DYNAMIC_PREFIXES.some(prefix => key.startsWith(prefix))) data[key] = localStorage.getItem(key)
  }
  return data
}

function applyPayload(data) {
  let applied = false
  for (const [key, value] of Object.entries(data)) {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, value)
      applied = true
    }
  }
  return applied
}

export function isOldHost() {
  return OLD_HOSTS.includes(location.hostname)
}

// Old domains no longer redirect on their own: they show a "moved" notice, and only
// when the visitor clicks the button do they leave, carrying this browser's saved
// data along. The new domain only fills in keys it doesn't already have, so it is
// safe to send the payload every time — nothing on baerimtools.com gets overwritten.
export function goToNewDomain() {
  const target = new URL(location.pathname + location.search, NEW_ORIGIN)
  const payload = collectPayload()
  if (Object.keys(payload).length > 0) {
    target.searchParams.set(MIGRATE_PARAM, toBase64(JSON.stringify(payload)))
  }
  target.hash = location.hash
  location.assign(target.toString())
}

// Call once on app boot, before anything reads localStorage.
export function applyIncomingMigration() {
  const params = new URLSearchParams(location.search)
  const encoded = params.get(MIGRATE_PARAM)
  if (!encoded) return

  try {
    applyPayload(JSON.parse(fromBase64(encoded)))
  } catch {
    // malformed/tampered payload — ignore, app just boots with empty local state
  }

  params.delete(MIGRATE_PARAM)
  const search = params.toString()
  history.replaceState(null, '', location.pathname + (search ? `?${search}` : '') + location.hash)
}
