import { useEffect, useRef } from 'react'
import { useConsent } from '../utils/consent'

const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID

export default function AdSlot({ slot, format = 'auto', className = '' }) {
  const consent = useConsent()
  const pushed = useRef(false)

  useEffect(() => {
    if (consent !== 'accepted' || !CLIENT_ID || pushed.current) return
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      // ad blocked or script not ready — nothing to do
    }
  }, [consent])

  if (consent !== 'accepted' || !CLIENT_ID) return null

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: 'block' }}
      data-ad-client={CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  )
}
