// Client-side mirror of worker/src/db.js's add-window check - used only for
// instant UI feedback (button enabled state, hints). The worker re-validates
// independently on insert, so a wrong client clock can't bypass the rule.

export function isOreAddWindowOpen(now = new Date()) {
  const minute = now.getMinutes()
  return (minute >= 28 && minute <= 39) || minute >= 58 || minute <= 9
}

// Only meaningful to call while the window is closed (minute in [10,27] or
// [40,57]) - the next moment isOreAddWindowOpen() turns true.
export function nextOreAddWindowOpensAt(now = new Date()) {
  const minute = now.getMinutes()
  const next = new Date(now)
  next.setSeconds(0, 0)
  if (minute < 28) {
    next.setMinutes(28)
    return next
  }
  next.setMinutes(58)
  return next
}
