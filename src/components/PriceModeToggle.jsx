import { useTranslation } from 'react-i18next'

export default function PriceModeToggle({ mode, setMode }) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-xl p-1 shrink-0">
      <button
        type="button"
        onClick={() => setMode('own')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mode === 'own' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
      >
        {t('materials.myOwnPrices')}
      </button>
      <button
        type="button"
        onClick={() => setMode('global')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mode === 'global' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
      >
        {t('materials.globalPrices')}
      </button>
    </div>
  )
}
