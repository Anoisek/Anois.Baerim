// One-time transfer of this browser's local data (nickname, collected mokoko markers,
// prices, ui prefs, etc.) from the old Vercel domain to the new Cloudflare Pages domain.
// localStorage is per-origin, so a plain DNS/host swap would leave everyone's saved
// progress behind — this carries it across via a signed-free redirect + query payload.

const OLD_HOST = 'anois-baerim.vercel.app'
const NEW_ORIGIN = 'https://anois-baerim.pages.dev'
const MIGRATE_PARAM = 'migrate'
const MIGRATED_FLAG = 'migrated_to_pages_dev'

const STATIC_KEYS = [
  'cookie_consent',
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
  'mokoko_announcement_v1_seen',
]

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
    if (key.startsWith('item_choices_')) data[key] = localStorage.getItem(key)
  }
  return data
}

// Call once on app boot. Returns true if it triggered a redirect (caller should skip rendering).
// Every visit to the old domain redirects to the new one; only the first visit (per browser)
// carries the localStorage payload along — later redirects are plain, data's already there.
export function redirectToNewDomain() {
  if (location.hostname !== OLD_HOST) return false

  const alreadyMigrated = localStorage.getItem(MIGRATED_FLAG) === 'true'
  const target = new URL(location.pathname + location.search, NEW_ORIGIN)

  if (!alreadyMigrated) {
    localStorage.setItem(MIGRATED_FLAG, 'true')
    const payload = collectPayload()
    if (Object.keys(payload).length > 0) {
      target.searchParams.set(MIGRATE_PARAM, toBase64(JSON.stringify(payload)))
    }
  }
  target.hash = location.hash

  location.replace(target.toString())
  return true
}

// Call once on app boot, before anything reads localStorage.
export function applyIncomingMigration() {
  const params = new URLSearchParams(location.search)
  const encoded = params.get(MIGRATE_PARAM)
  if (!encoded) return

  try {
    const data = JSON.parse(fromBase64(encoded))
    for (const [key, value] of Object.entries(data)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    }
  } catch {
    // malformed/tampered payload — ignore, app just boots with empty local state
  }

  params.delete(MIGRATE_PARAM)
  const search = params.toString()
  history.replaceState(null, '', location.pathname + (search ? `?${search}` : '') + location.hash)
}
