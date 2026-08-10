import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModalSlot } from '../context/ModalQueueContext'

const ANNOUNCEMENT_KEY = 'mokoko_announcement_v1_seen'

export default function MokokoAnnouncement() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(ANNOUNCEMENT_KEY) === 'true')
  const isOpen = useModalSlot('mokokoAnnouncement', !dismissed)

  function handleClose() {
    localStorage.setItem(ANNOUNCEMENT_KEY, 'true')
    setDismissed(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 text-center shadow-xl shadow-black/40">
        <img src="/happy_mokoko.png" alt="" className="w-28 h-28 object-contain" />
        <h2 className="text-xl font-bold text-yellow-400">{t('announcement.title')}</h2>
        <div className="flex flex-col gap-3 text-sm text-gray-300 leading-relaxed">
          <p>{t('announcement.intro')}</p>
          <p>{t('announcement.thanks')}</p>
          <p>{t('announcement.closing')}</p>
        </div>
        <button
          onClick={handleClose}
          className="mt-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold rounded-xl px-8 py-2.5 transition-colors"
        >
          {t('announcement.button')}
        </button>
      </div>
    </div>
  )
}
