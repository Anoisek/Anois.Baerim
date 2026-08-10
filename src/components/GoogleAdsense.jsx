import { useEffect } from 'react'
import { useConsent } from '../utils/consent'

const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID

export default function GoogleAdsense() {
  const consent = useConsent()

  useEffect(() => {
    if (consent !== 'accepted' || !CLIENT_ID) return
    if (document.querySelector('script[data-adsbygoogle]')) return

    const script = document.createElement('script')
    script.async = true
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`
    script.crossOrigin = 'anonymous'
    script.dataset.adsbygoogle = 'true'
    document.head.appendChild(script)
  }, [consent])

  return null
}
