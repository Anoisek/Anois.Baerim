const STORAGE_KEY = 'baerim_visitor_id'

function readOrCreate() {
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

// A single module-level promise (not a plain function called fresh each time) so every
// caller in this tab's lifetime awaits the SAME result, and — via the Web Locks API,
// which serializes this critical section across every tab/window of the same origin —
// several tabs opened at nearly the same instant converge on one id instead of each
// seeing an empty localStorage and generating (and persisting) their own.
export const visitorIdPromise = typeof navigator !== 'undefined' && navigator.locks
  ? navigator.locks.request('baerim-visitor-id', () => readOrCreate())
  : Promise.resolve(readOrCreate())
