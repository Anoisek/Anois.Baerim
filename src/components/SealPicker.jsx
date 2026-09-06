import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function SealPicker({ seals, selected, onChange, horizontal }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef(null)
  const wrap = horizontal ? 'bg-black/30 border-white/10 w-full h-9' : 'bg-gray-800 border-gray-600 w-32 shrink-0'
  const panel = horizontal ? 'bg-[#1c1712] border-white/10' : 'bg-gray-800 border-gray-600'
  const rowHover = horizontal ? 'hover:bg-white/5' : 'hover:bg-gray-700'

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // A row near the bottom of a long list doesn't have 13rem (max-h-52) of
  // room below it before hitting the footer — flip the panel upward there.
  useEffect(() => {
    if (!horizontal || !open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setOpenUp(spaceBelow < 224 && rect.top > spaceBelow)
  }, [horizontal, open])

  function toggle(id) {
    onChange(
      selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id]
    )
  }

  const label = selected.length === 0
    ? t('sealPicker.noSeal')
    : selected.length === 1
      ? seals.find(s => s.id === selected[0])?.name ?? t('sealPicker.seal')
      : t('sealPicker.seals', { count: selected.length })

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`border rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-yellow-400 flex items-center gap-1 ${wrap}`}
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={`absolute left-0 z-50 border rounded-lg shadow-xl min-w-40 max-h-52 overflow-y-auto ${panel} ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {seals.length === 0 && (
            <p className="text-gray-500 text-xs px-3 py-2">{t('sealPicker.noSealsDefined')}</p>
          )}
          <label className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${rowHover}`}>
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={() => onChange([])}
              className="accent-yellow-400"
            />
            <span className="text-sm text-gray-300">{t('sealPicker.noSeal')}</span>
          </label>
          {seals.map(s => (
            <label key={s.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${rowHover}`}>
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)}
                className="accent-yellow-400"
              />
              {s.image_url
                ? <img src={s.image_url} alt={s.name} className="w-5 h-5 object-contain" />
                : <span className="text-sm">🔮</span>}
              <span className="text-sm text-white">{s.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
