import { useState } from 'react'
import { createPortal } from 'react-dom'

const STICKY_KEY = 'sticky_total_bar'

function loadStickyTotal() {
  return localStorage.getItem(STICKY_KEY) === '1'
}

export function useStickyTotal() {
  const [sticky, setSticky] = useState(loadStickyTotal)
  function updateSticky(value) {
    setSticky(value)
    localStorage.setItem(STICKY_KEY, value ? '1' : '0')
  }
  return [sticky, updateSticky]
}

export default function StickyTotalBar({ sticky, maxWidthClass = 'max-w-4xl', children }) {
  if (!sticky) {
    return <div className="flex flex-col gap-3">{children}</div>
  }
  return (
    <>
      <div className="h-40" />
      {createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-yellow-400/30 px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
          <div className={`${maxWidthClass} mx-auto flex flex-col gap-3`}>
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
