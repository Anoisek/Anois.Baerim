import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n/languages'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0]

  function selectLanguage(code) {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-xl leading-none hover:opacity-80 transition-opacity p-1.5"
        title={current.label}
      >
        {current.flag}
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-44 max-h-80 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/40 z-50 py-1">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => selectLanguage(l.code)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-800 transition-colors ${
                l.code === current.code ? 'text-yellow-400' : 'text-gray-200'
              }`}
            >
              <span className="text-lg leading-none">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
