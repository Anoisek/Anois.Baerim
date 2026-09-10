import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { loadAdSenseScript } from '../utils/adsense'

const CONSENT_KEY = 'ads_consent'

export default function AdConsentBanner() {
  const { t } = useTranslation()
  const [choice, setChoice] = useState(() => localStorage.getItem(CONSENT_KEY))

  useEffect(() => {
    if (choice === 'accepted') loadAdSenseScript()
  }, [choice])

  if (choice) return null

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setChoice('accepted')
  }

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setChoice('declined')
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 backdrop-blur border-t border-gray-800">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3 text-xs text-gray-300">
        <p className="flex-1 text-center sm:text-left">
          {t('adsConsent.message')}{' '}
          <Link to="/privacy-policy" className="text-yellow-400 hover:underline">
            {t('adsConsent.learnMore')}
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            {t('adsConsent.decline')}
          </button>
          <button
            onClick={handleAccept}
            className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold rounded-lg px-4 py-2 transition-colors"
          >
            {t('adsConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
