import { useTranslation } from 'react-i18next'

export default function PriceModeToggle({ mode, setMode, horizontal }) {
  const { t } = useTranslation()
  const wrap = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-600'
  const hoverInactive = horizontal ? 'hover:bg-white/10' : 'hover:bg-gray-700'
  return (
    <div className={`flex gap-1 border rounded-xl p-1 shrink-0 ${wrap}`}>
      <button
        type="button"
        onClick={() => setMode('own')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mode === 'own' ? 'bg-yellow-400 text-gray-950' : `text-gray-300 ${hoverInactive}`}`}
      >
        {t('materials.myOwnPrices')}
      </button>
      <button
        type="button"
        onClick={() => setMode('global')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mode === 'global' ? 'bg-yellow-400 text-gray-950' : `text-gray-300 ${hoverInactive}`}`}
      >
        {t('materials.globalPrices')}
      </button>
    </div>
  )
}
