import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const NOTICE_KEY = 'domain_change_notice_v1_seen'

export default function DomainChangeNotice() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(NOTICE_KEY) === 'true')

  function handleClose() {
    localStorage.setItem(NOTICE_KEY, 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 text-center shadow-xl shadow-black/40">
        <img src="/switch_mokoko.png" alt="" className="w-28 h-28 object-contain" />
        <h2 className="text-xl font-bold text-yellow-400">{t('domainChange.title')}</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{t('domainChange.body')}</p>
        <button
          onClick={handleClose}
          className="mt-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold rounded-xl px-8 py-2.5 transition-colors"
        >
          {t('domainChange.button')}
        </button>
      </div>
    </div>
  )
}
