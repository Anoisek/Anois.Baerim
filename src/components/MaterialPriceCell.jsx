import { useTranslation } from 'react-i18next'
import { formatYang } from '../utils/formatYang'
import { submitPriceToGlobal, FIXED_MATERIAL_PRICES } from '../utils/priceBook'

// `bare` drops the cell's own border/background/rounding so it can sit
// seamlessly inside another component's box (e.g. one unified material tag)
// instead of nesting one bordered box inside another.
export default function MaterialPriceCell({ material, rawValue, computedValue, onPriceChange, computed, manualOverride, allowGlobalSubmit = true, bare = false }) {
  const { t } = useTranslation()
  const isFixed = FIXED_MATERIAL_PRICES[material.id] != null
  // Display text (no_price / computed) sizes to its own content — a fixed
  // width there just clips longer numbers or words. Only the editable input
  // keeps a fixed width, which is normal for a text field either way.
  const textBox = bare ? 'text-sm min-w-[3rem] text-right shrink-0' : 'bg-gray-800/60 border rounded-lg px-3 py-1.5 min-w-[7rem] text-right text-sm shrink-0'
  const inputBox = bare ? 'rounded px-1.5 text-sm w-16 text-right shrink-0' : 'rounded-lg px-3 py-1.5 w-28 text-right text-sm shrink-0'

  if (material.no_price) {
    return (
      <span
        title={t('materialPriceCell.noPriceTooltip')}
        className={`${textBox} font-mono ${bare ? 'text-gray-500' : 'border-gray-700 text-gray-500'}`}
      >
        {t('materialPriceCell.noPrice')}
      </span>
    )
  }
  if (isFixed || (computed ?? (material.is_craftable && !manualOverride))) {
    return (
      <span
        title={t('materialPriceCell.computedTooltip')}
        className={`${textBox} font-mono ${bare ? 'text-green-400' : 'border-green-700/50 text-green-400'}`}
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
      onBlur={e => { if (allowGlobalSubmit) submitPriceToGlobal(material.id, e.target.value) }}
      className={`${inputBox} focus:outline-none transition-colors ${bare ? 'bg-black/25 text-white placeholder:text-gray-600 focus:ring-1 focus:ring-yellow-400' : 'bg-gray-800 border border-gray-700 text-white focus:border-yellow-400'}`}
    />
  )
}
