import { useState } from 'react'

const STICKY_KEY = 'sticky_total_bar'

function loadStickyTotal() {
  const stored = localStorage.getItem(STICKY_KEY)
  return stored === null ? true : stored === '1'
}

export function useStickyTotal() {
  const [sticky, setSticky] = useState(loadStickyTotal)
  function updateSticky(value) {
    setSticky(value)
    localStorage.setItem(STICKY_KEY, value ? '1' : '0')
  }
  return [sticky, updateSticky]
}

export default function StickyTotalBar({ sticky, children }) {
  if (!sticky) {
    return <div className="flex flex-col gap-3">{children}</div>
  }
  return (
    <div className="sticky bottom-4 z-40 flex flex-col gap-3 bg-gray-950/95 backdrop-blur-md border border-yellow-400/30 rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {children}
    </div>
  )
}
