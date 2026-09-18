import { useTranslation } from 'react-i18next'
import { goToNewDomain } from '../utils/domainMigration'

// Shown instead of the whole app on the old domains (pages.dev / vercel.app).
export default function MovedNotice() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-white">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-8 flex flex-col items-center gap-4 text-center shadow-xl shadow-black/40">
        <img src="/switch_mokoko.png" alt="" className="w-28 h-28 object-contain" />
        <h1 className="text-xl font-bold text-yellow-400">{t('moved.title')}</h1>
        <p className="text-sm text-gray-300 leading-relaxed">{t('moved.body')}</p>
        <button
          onClick={goToNewDomain}
          className="mt-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold rounded-xl px-8 py-2.5 transition-colors"
        >
          {t('moved.button')} → baerimtools.com
        </button>
      </div>
    </div>
  )
}
