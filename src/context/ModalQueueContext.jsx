import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ModalQueueContext = createContext(null)

export function ModalQueueProvider({ children }) {
  const [queue, setQueue] = useState([])
  const value = useMemo(() => ({ queue, setQueue }), [queue])
  return <ModalQueueContext.Provider value={value}>{children}</ModalQueueContext.Provider>
}

// Coordinates full-screen one-time popups so only one shows at a time, in the order
// they first asked to open. Pass a unique id and whether this popup currently has
// something to show; get back whether it's actually this popup's turn to render.
export function useModalSlot(id, wantsOpen) {
  const ctx = useContext(ModalQueueContext)

  useEffect(() => {
    if (!ctx) return
    ctx.setQueue(prev => {
      if (wantsOpen) return prev.includes(id) ? prev : [...prev, id]
      return prev.includes(id) ? prev.filter(x => x !== id) : prev
    })
  }, [wantsOpen, id, ctx])

  if (!ctx) return wantsOpen
  return wantsOpen && ctx.queue[0] === id
}
