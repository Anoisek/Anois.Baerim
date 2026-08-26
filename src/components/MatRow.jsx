import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatYang } from '../utils/formatYang'
import { FIXED_MATERIAL_PRICES } from '../utils/priceBook'
import { rawItemName } from '../utils/itemName'
import { slugify } from '../utils/slug'
import MaterialPriceCell from './MaterialPriceCell'

export default function MatRow({ mat, quantity, unitPrice, rawValue, onPriceChange, kind, globalMode, manualOverrides, onToggleManualOverride }) {
  const { t } = useTranslation()
  const lineTotal = unitPrice * quantity
  const manualOverride = manualOverrides?.has(mat.id) ?? false
  // Any priced row can be temporarily overridden for this session — materials or
  // crafted items, in own- or global-price mode — except rows with no price at all
  // (no_price materials) or a fixed currency value (Gold Bars) that's never editable.
  const canOverride = !mat.no_price && !FIXED_MATERIAL_PRICES[mat.id] && !!onToggleManualOverride
  const to = kind === 'item' ? `/chapter/${mat.category_id}/item/${slugify(rawItemName(mat))}` : `/materials/${mat.id}`
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Link to={to} className="w-8 h-8 shrink-0 flex items-center justify-center hover:opacity-75 transition-opacity" title={mat.name}>
        {mat.image_url
          ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain" />
          : <span className="text-lg">{kind === 'item' ? '⚔️' : '🧪'}</span>}
      </Link>
      <span className="flex-1 text-sm text-gray-200 truncate">{mat.name}</span>
      <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
        {canOverride && (
          <input
            type="checkbox"
            checked={manualOverride}
            onChange={() => onToggleManualOverride(mat.id)}
            title={t('materials.manualPrice')}
            className="accent-yellow-400 w-3.5 h-3.5 shrink-0"
          />
        )}
      </div>
      <span className="text-gray-500 text-xs w-9 text-right shrink-0">×{quantity}</span>
      <MaterialPriceCell
        material={mat}
        rawValue={rawValue}
        computedValue={unitPrice}
        onPriceChange={onPriceChange}
        computed={manualOverride ? false : (kind === 'item' || globalMode ? true : undefined)}
        manualOverride={manualOverride}
        allowGlobalSubmit={kind !== 'item'}
      />
      <span className="text-yellow-400 text-sm w-24 text-right font-mono shrink-0">{formatYang(lineTotal)}</span>
    </div>
  )
}
