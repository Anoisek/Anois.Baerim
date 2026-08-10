import { useEffect, useState } from 'react'

export const CONSENT_KEY = 'cookie_consent'
const CONSENT_EVENT = 'cookie-consent-change'

export function getConsent() {
  return localStorage.getItem(CONSENT_KEY)
}

export function setConsent(value) {
  localStorage.setItem(CONSENT_KEY, value)
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

export function resumeAds() {
  if (window.__adsResumed) return

  function tryResume() {
    if (typeof window.adsbygoogle?.requestAds === 'function') {
      window.adsbygoogle.requestAds()
      window.__adsResumed = true
      return true
    }
    return false
  }

  if (tryResume()) return
  const interval = setInterval(() => {
    if (tryResume()) clearInterval(interval)
  }, 200)
  setTimeout(() => clearInterval(interval), 15000)
}

export function useConsent() {
  const [consent, setConsentState] = useState(getConsent)

  useEffect(() => {
    function handleChange() {
      setConsentState(getConsent())
    }
    window.addEventListener(CONSENT_EVENT, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(CONSENT_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  return consent
}
