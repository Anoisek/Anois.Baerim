import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUiScale } from '../context/UiScaleContext'

export default function UiScaleToggle() {
  const { scale, setScale, MIN_SCALE, MAX_SCALE, DEFAULT_SCALE } = useUiScale()
  const { t } = useTranslation()
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
        title={t('uiScale.title')}
      >
        🔍
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/40 z-50 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{t('uiScale.label')}</span>
            <span className="text-gray-200 font-mono">{scale}%</span>
          </div>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={5}
            value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className="w-full accent-yellow-400"
          />
          <button
            onClick={() => setScale(DEFAULT_SCALE)}
            className="self-start text-xs text-gray-400 hover:text-yellow-400 transition-colors"
          >
            {t('uiScale.reset')}
          </button>
        </div>
      )}
    </div>
  )
}
