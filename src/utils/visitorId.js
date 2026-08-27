const STORAGE_KEY = 'baerim_visitor_id'

// Anonymous per-browser id used only to count distinct visitors (see VisitorPing /
// VisitorStatsWidget) — no account, no IP, nothing personally identifying.
export function getVisitorId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return null
  }
}
