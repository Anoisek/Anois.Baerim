import { useTranslation } from 'react-i18next'

export default function ConfirmBulkMarkModal({ mode, onConfirm, onCancel }) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 text-center shadow-xl shadow-black/40">
        <h2 className="text-lg font-bold text-white">{t('maps.confirmBulkMarkTitle')}</h2>
        <p className="text-sm text-red-400 leading-relaxed">
          {mode === 'select' ? t('maps.confirmSelectAllWarning') : t('maps.confirmDeselectAllWarning')}
        </p>
        <div className="flex gap-2 w-full">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-bold rounded-lg py-2.5 transition-colors"
          >
            {t('maps.confirmBulkMarkYes')}
          </button>
        </div>
      </div>
    </div>
  )
}
