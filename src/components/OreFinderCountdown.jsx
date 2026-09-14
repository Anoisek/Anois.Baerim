import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function getRemaining(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return ms > 0 ? ms : 0
}

export default function OreFinderCountdown({ expiresAt, onExpire }) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(() => getRemaining(expiresAt))

  useEffect(() => {
    setRemaining(getRemaining(expiresAt))
    const id = setInterval(() => {
      const next = getRemaining(expiresAt)
      setRemaining(prev => {
        if (next <= 0 && prev > 0) onExpire?.()
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [expiresAt, onExpire])

  if (remaining <= 0) return null

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  return (
    <span className="font-mono text-gray-200 font-semibold">
      {minutes} {t('maps.countdownMinutes')}, {seconds} {t('maps.countdownSeconds')}
    </span>
  )
}
