import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DonateButton() {
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
        className="hover:opacity-80 transition-opacity"
        style={{ fontSize: 18, lineHeight: 1, padding: 6 }}
        title={t('donate.title')}
      >
        💛
      </button>
      {open && (
        <div
          className="absolute left-0 bg-gray-900 border border-gray-700 shadow-xl shadow-black/40 z-50 flex flex-col items-center text-center"
          style={{ top: '100%', marginTop: 8, width: 250, padding: 16, gap: 10, borderRadius: 12 }}
        >
          <img src="/please.png" alt="" style={{ width: 64, height: 64 }} />
          <p className="text-gray-200" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {t('donate.description')}
          </p>
          <p className="text-yellow-400 font-semibold" style={{ fontSize: 13 }}>
            {t('donate.nickLabel')} <span className="font-mono">Anois</span>
          </p>
        </div>
      )}
    </div>
  )
}
