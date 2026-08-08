import { useEffect, useRef, useState } from 'react'
import { useNightMode } from '../context/NightModeContext'

export default function NightModeSlider() {
  const { dim, setDim } = useNightMode()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-lg leading-none hover:opacity-80 transition-opacity p-1.5"
        title="Night mode"
      >
        🌙
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/40 z-50 p-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>☀️</span>
            <span className="text-gray-300">{dim}%</span>
            <span>🌑</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={dim}
            onChange={e => setDim(Number(e.target.value))}
            className="w-full accent-yellow-400"
          />
        </div>
      )}
    </div>
  )
}
