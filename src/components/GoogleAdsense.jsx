import { useEffect } from 'react'
import { useConsent, resumeAds } from '../utils/consent'

export default function GoogleAdsense() {
  const consent = useConsent()

  useEffect(() => {
    if (consent === 'accepted') resumeAds()
  }, [consent])

  return null
}
