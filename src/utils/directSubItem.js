// A subcategory that holds exactly one item named the same as itself (e.g.
// "Energy Crystal" → "Energy Crystal") is just a wrapper around that item, so
// its tile links straight to the item page instead of a one-tile list.
export function directItemFor(sub, items) {
  if (!sub) return null
  const own = (items ?? []).filter(i => i.subcategory_id === sub.id)
  if (own.length !== 1) return null
  return own[0].name.trim().toLowerCase() === sub.name.trim().toLowerCase() ? own[0] : null
}
