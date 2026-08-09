import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const COMPLETION_KEY = 'mokoko_all_collected_seen'

export default function MokokoCompletionModal({ show }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(COMPLETION_KEY) === 'true')

  function handleClose() {
    localStorage.setItem(COMPLETION_KEY, 'true')
    setDismissed(true)
  }

  if (dismissed || !show) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 text-center shadow-xl shadow-black/40">
        <img src="/happy_mokoko.png" alt="" className="w-28 h-28 object-contain" />
        <h2 className="text-xl font-bold text-yellow-400">{t('completion.title')}</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{t('completion.body')}</p>
        <button
          onClick={handleClose}
          className="mt-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold rounded-xl px-8 py-2.5 transition-colors"
        >
          {t('completion.button')}
        </button>
      </div>
    </div>
  )
}
