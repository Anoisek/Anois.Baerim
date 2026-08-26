// One-time transfer of this browser's local data (nickname, collected mokoko markers,
// prices, ui prefs, etc.) from an old domain to the current one. localStorage is
// per-origin, so a plain DNS/host swap would leave everyone's saved progress behind —
// this carries it across via a signed-free redirect + query payload.

const OLD_HOSTS = new Set(['anois-baerim.vercel.app', 'anois-baerim.pages.dev'])
const NEW_ORIGIN = 'https://baerimtools.com'
const MIGRATE_PARAM = 'migrate'
const MIGRATED_FLAG = 'migrated_to_baerimtools'

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

// Call once on app boot. Returns true if it triggered a redirect (caller should skip rendering).
// Every visit to an old domain redirects to the new one; only the first visit (per browser)
// carries the localStorage payload along — later redirects are plain, data's already there.
export function redirectToNewDomain() {
  if (!OLD_HOSTS.has(location.hostname)) return false

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
    applyPayload(JSON.parse(fromBase64(encoded)))
  } catch {
    // malformed/tampered payload — ignore, app just boots with empty local state
  }

  params.delete(MIGRATE_PARAM)
  const search = params.toString()
  history.replaceState(null, '', location.pathname + (search ? `?${search}` : '') + location.hash)
}

const BRIDGE_MESSAGE = 'baerim-migration-export'

// Call once on app boot (old domains only). If this page has been embedded in a
// hidden iframe by requestManualRecovery() below, it skips the normal top-level
// redirect and just hands its localStorage to the parent window instead. Returns
// true if it acted as a bridge (caller should skip rendering — nothing to show).
export function exportPayloadToParentIfFramed() {
  if (!OLD_HOSTS.has(location.hostname)) return false
  if (window.self === window.top) return false

  try {
    window.parent.postMessage({ type: BRIDGE_MESSAGE, payload: collectPayload() }, NEW_ORIGIN)
  } catch {
    // ignore — parent will just time out
  }
  return true
}

export function isNewDomain() {
  return location.hostname === new URL(NEW_ORIGIN).hostname
}

// Manual fallback for the "restore my data" button: pulls localStorage from every
// old domain via a hidden iframe + postMessage bridge (no top-level navigation, no
// query-param payload needed — the user's data never left their own browser this
// whole time, this just reaches across origins to fetch it once). Resolves true if
// anything new was applied.
export function requestManualRecovery({ timeoutMs = 6000 } = {}) {
  return new Promise(resolve => {
    let settled = false
    let appliedAny = false
    let pending = OLD_HOSTS.size
    const frames = []

    function finish(result) {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      frames.forEach(f => f.remove())
      resolve(result)
    }

    function onMessage(event) {
      if (event.data?.type !== BRIDGE_MESSAGE) return
      if (!OLD_HOSTS.has(new URL(event.origin).hostname)) return
      if (applyPayload(event.data.payload || {})) appliedAny = true
      pending -= 1
      if (pending <= 0) finish(appliedAny)
    }

    window.addEventListener('message', onMessage)

    for (const host of OLD_HOSTS) {
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = `https://${host}/`
      document.body.appendChild(iframe)
      frames.push(iframe)
    }

    setTimeout(() => finish(appliedAny), timeoutMs)
  })
}
