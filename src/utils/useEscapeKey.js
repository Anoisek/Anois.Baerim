import { useEffect, useRef } from 'react'

// Every open popup registers here; Escape closes only the newest one, so a popup
// opened on top of another (e.g. an image zoom inside a modal) closes first.
const stack = []

function onKeyDown(e) {
  if (e.key !== 'Escape') return
  const top = stack.findLast(entry => entry.doc === e.currentTarget)
  top?.handler.current?.(e)
}

const listening = new Set()
function listen(doc) {
  if (listening.has(doc)) return
  listening.add(doc)
  doc.addEventListener('keydown', onKeyDown)
}

// Calls `onEscape` when Escape is pressed while this popup is the top-most one.
// `active` = false unregisters it (for popups that stay mounted while hidden).
// `doc` = the document to listen on, for popups rendered into another window (PiP).
export default function useEscapeKey(onEscape, active = true, doc = null) {
  const handler = useRef(onEscape)
  handler.current = onEscape

  useEffect(() => {
    if (!active) return
    const target = doc ?? document
    listen(target)
    const entry = { handler, doc: target }
    stack.push(entry)
    return () => {
      const i = stack.indexOf(entry)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [active, doc])
}
