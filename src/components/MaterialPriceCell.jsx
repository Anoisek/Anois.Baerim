import { useTranslation } from 'react-i18next'
import { formatYang } from '../utils/formatYang'

export default function MaterialPriceCell({ material, rawValue, computedValue, onPriceChange, computed, manualOverride }) {
  const { t } = useTranslation()
  if (computed ?? (material.is_craftable && !manualOverride)) {
    return (
      <span
        title={t('materialPriceCell.computedTooltip')}
        className="bg-gray-800/60 border border-green-700/50 rounded-lg px-3 py-1.5 w-28 text-right text-sm text-green-400 font-mono shrink-0"
      >
        {formatYang(computedValue)}
      </span>
    )
  }
  return (
    <input
      type="text"
      placeholder={t('materialPriceCell.pricePlaceholder')}
      value={rawValue ?? ''}
      onChange={e => onPriceChange(material.id, e.target.value)}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 w-28 text-right text-sm focus:outline-none focus:border-yellow-400 shrink-0 transition-colors"
    />
  )
}
