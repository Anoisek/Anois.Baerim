import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function getRemaining(revealAt) {
  const ms = new Date(revealAt).getTime() - Date.now()
  return ms > 0 ? ms : 0
}

export default function MokokoRevealCountdown({ revealAt }) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(() => getRemaining(revealAt))

  useEffect(() => {
    setRemaining(getRemaining(revealAt))
    const id = setInterval(() => setRemaining(getRemaining(revealAt)), 1000)
    return () => clearInterval(id)
  }, [revealAt])

  if (remaining <= 0) return null

  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  return (
    <div className="mt-3 text-xs text-gray-400 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 inline-flex items-center gap-1.5 flex-wrap">
      <span>{t('maps.pendingRevealLabel')}</span>
      <span className="font-mono text-gray-200 font-semibold">
        {days} {t('maps.countdownDays')}, {hours} {t('maps.countdownHours')}, {minutes} {t('maps.countdownMinutes')}, {seconds} {t('maps.countdownSeconds')}
      </span>
    </div>
  )
}
