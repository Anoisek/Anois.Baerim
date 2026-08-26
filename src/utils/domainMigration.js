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
  if (!OLD_HOSTS.includes(location.hostname)) return false

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

// Call once on app boot (old domains only). If this page was opened as a popup by
// requestManualRecovery() below, it skips the normal top-level redirect and just
// hands its localStorage to the opener window instead. Returns true if it acted as
// a bridge (caller should skip rendering — nothing to show).
//
// This has to be a real popup (window.open), not a hidden iframe: browsers
// increasingly partition/isolate localStorage for cross-site iframes (Firefox's
// Total Cookie Protection, Safari ITP, and privacy-hardened Chromium builds like
// Opera GX all do this) — an iframe of this domain embedded under baerimtools.com
// would see an empty, isolated storage bucket instead of the real one. A popup is
// a genuine top-level navigation to this origin, so it isn't subject to that.
export function exportPayloadToOpenerIfPopup() {
  if (!OLD_HOSTS.includes(location.hostname)) return false
  if (!window.opener) return false

  try {
    window.opener.postMessage({ type: BRIDGE_MESSAGE, payload: collectPayload() }, NEW_ORIGIN)
  } catch {
    // ignore — opener will just time out
  }
  return true
}

export function isNewDomain() {
  return location.hostname === new URL(NEW_ORIGIN).hostname
}

// Manual fallback for the "restore my data" button: pulls localStorage from every
// old domain via a small popup + postMessage bridge (no top-level navigation of
// *this* tab — the popup does that on the old domain's behalf, reads its real
// localStorage, hands it back, and closes itself). Resolves true if anything new
// was applied.
//
// Both old domains are queried at once, but responses are buffered and applied in
// OLD_HOSTS priority order once everyone's answered (or timed out) — not in
// whatever order the network happens to deliver them. Otherwise, for someone who
// has different values saved on both old domains, the "winner" for a given key
// would come down to which popup loaded faster, not which domain actually held
// the newer data.
export function requestManualRecovery({ timeoutMs = 8000 } = {}) {
  return new Promise(resolve => {
    let settled = false
    let pending = 0
    const popups = []
    const payloadByHost = {}

    function finish() {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      popups.forEach(w => { try { w.close() } catch { /* already closed */ } })

      let appliedAny = false
      for (const host of OLD_HOSTS) {
        if (payloadByHost[host] && applyPayload(payloadByHost[host])) appliedAny = true
      }
      resolve(appliedAny)
    }

    function onMessage(event) {
      if (event.data?.type !== BRIDGE_MESSAGE) return
      const host = new URL(event.origin).hostname
      if (!OLD_HOSTS.includes(host) || payloadByHost[host]) return
      payloadByHost[host] = event.data.payload || {}
      pending -= 1
      if (pending <= 0) finish()
    }

    window.addEventListener('message', onMessage)

    for (const host of OLD_HOSTS) {
      // Off-screen + tiny: browsers won't let it be truly invisible (that's the
      // point of it being a real top-level window), but this keeps it out of the
      // way for the second it's open.
      const popup = window.open(`https://${host}/`, '', 'width=80,height=80,left=-1000,top=-1000')
      if (popup) { popups.push(popup); pending += 1 }
    }

    if (pending === 0) { finish(); return } // popup blocker got all of them
    setTimeout(finish, timeoutMs)
  })
}
