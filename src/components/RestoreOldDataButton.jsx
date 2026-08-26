import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isNewDomain, requestManualRecovery } from '../utils/domainMigration'

const DISMISSED_KEY = 'restore_old_data_dismissed'

export default function RestoreOldDataButton() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true')
  const [status, setStatus] = useState('idle') // idle | loading | done | empty

  if (!isNewDomain() || dismissed) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  async function handleClick() {
    setStatus('loading')
    const found = await requestManualRecovery()
    if (found) {
      location.reload()
      return
    }
    setStatus('empty')
    setTimeout(dismiss, 2500)
  }

  return (
    <div className="fixed top-20 right-4 z-40 flex items-center gap-1.5 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-full pl-3 pr-1.5 py-1.5 shadow-lg shadow-black/30">
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="text-xs font-semibold text-gray-200 hover:text-yellow-400 disabled:opacity-60 transition-colors whitespace-nowrap"
      >
        {status === 'idle' && t('restoreData.button')}
        {status === 'loading' && t('restoreData.loading')}
        {status === 'empty' && t('restoreData.empty')}
      </button>
      <button
        onClick={dismiss}
        className="w-5 h-5 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors text-xs"
        title={t('common.close')}
      >
        ×
      </button>
    </div>
  )
}
