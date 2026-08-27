import { formatYang } from '../utils/formatYang'

// Parallels MaterialPriceCell.jsx for the Alchemy page's flat string-keyed prices.
export default function AlchemyPriceCell({ mode, rawValue, resolvedValue, onChange, onBlurSubmit }) {
  if (mode === 'global') {
    return (
      <span
        title="Community global price"
        className="bg-gray-800/60 border border-green-700/50 rounded-lg px-2 py-1.5 w-full text-right text-xs text-green-400 font-mono"
      >
        {formatYang(resolvedValue)}
      </span>
    )
  }
  return (
    <input
      type="text"
      placeholder="Price"
      value={rawValue ?? ''}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlurSubmit(e.target.value)}
      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 w-full text-right text-xs focus:outline-none focus:border-yellow-400 transition-colors"
    />
  )
}
