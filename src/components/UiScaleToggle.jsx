import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUiScale } from '../context/UiScaleContext'

export default function UiScaleToggle() {
  const { scale, setScale, MIN_SCALE, MAX_SCALE, DEFAULT_SCALE } = useUiScale()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [previewScale, setPreviewScale] = useState(scale)
  const ref = useRef(null)

  useEffect(() => {
    setPreviewScale(scale)
  }, [scale])

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
        className="hover:opacity-80 transition-opacity"
        style={{ fontSize: 18, lineHeight: 1, padding: 6 }}
        title={t('uiScale.title')}
      >
        🔍
      </button>
      {open && (
        <div
          className="absolute left-0 bg-gray-900 border border-gray-700 shadow-xl shadow-black/40 z-50 flex flex-col"
          style={{ top: '100%', marginTop: 8, width: 224, padding: 12, gap: 8, borderRadius: 12 }}
        >
          <div className="flex items-center justify-between text-gray-400" style={{ fontSize: 12 }}>
            <span>{t('uiScale.label')}</span>
            <span className="text-gray-200 font-mono">{previewScale}%</span>
          </div>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={5}
            value={previewScale}
            onChange={e => setPreviewScale(Number(e.target.value))}
            onMouseUp={e => setScale(Number(e.target.value))}
            onTouchEnd={e => setScale(Number(e.target.value))}
            onKeyUp={e => setScale(Number(e.target.value))}
            className="accent-yellow-400"
            style={{ width: '100%' }}
          />
          <button
            onClick={() => { setPreviewScale(DEFAULT_SCALE); setScale(DEFAULT_SCALE) }}
            className="self-start text-gray-400 hover:text-yellow-400 transition-colors"
            style={{ fontSize: 12 }}
          >
            {t('uiScale.reset')}
          </button>
        </div>
      )}
    </div>
  )
}
