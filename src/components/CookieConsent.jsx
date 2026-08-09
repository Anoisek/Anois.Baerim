import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const CONSENT_KEY = 'cookie_consent'

export default function CookieConsent() {
  const { t } = useTranslation()
  const [choice, setChoice] = useState(() => localStorage.getItem(CONSENT_KEY))

  function choose(value) {
    localStorage.setItem(CONSENT_KEY, value)
    setChoice(value)
  }

  if (choice) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-950/95 backdrop-blur-sm border-t border-gray-700 px-4 py-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-3">
        <p className="text-xs text-gray-300 flex-1">
          {t('cookieConsent.message')}{' '}
          <Link to="/privacy-policy" className="text-yellow-400 hover:underline">
            {t('cookieConsent.learnMore')}
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose('declined')}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
          >
            {t('cookieConsent.decline')}
          </button>
          <button
            onClick={() => choose('accepted')}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-yellow-400 hover:bg-yellow-300 text-gray-950 transition-colors"
          >
            {t('cookieConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
