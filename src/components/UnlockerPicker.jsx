import { Link } from 'react-router-dom'
import { formatYang } from '../utils/formatYang'
import { slugify } from '../utils/slug'

// Optional one-time unlockers of an item (see ITEM_UNLOCKERS): tiles side by
// side, each with a checkbox underneath — a checked one adds its price once.
// renderPrice(mat) lets the vertical page put an editable price cell here
// (its step cards are where prices are typed in); the horizontal page just
// shows the price, since it edits prices in its "Adjust prices" modal.
export default function UnlockerPicker({ mats, selected, onToggle, priceOf, renderPrice, horizontal }) {
  if (mats.length === 0) return null
  const tile = horizontal
    ? 'bg-black/20 border-white/10'
    : 'bg-gray-900 border-gray-700'
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {mats.map(mat => {
        const on = selected.includes(mat.id)
        return (
          <div
            key={mat.id}
            className={`flex flex-col items-center gap-2 w-36 px-3 py-3 rounded-xl border transition-colors ${tile} ${on ? '!border-yellow-400/60' : 'hover:border-yellow-400/30'}`}
          >
            <Link to={`/materials/${slugify(mat.name)}`} className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/25 hover:bg-black/40 transition-colors" title={mat.name}>
              {mat.image_url ? <img src={mat.image_url} alt={mat.name} className="w-7 h-7 object-contain" /> : <span className="text-sm">🧪</span>}
            </Link>
            <span className="text-xs text-gray-200 text-center leading-tight min-h-[2rem] flex items-center">{mat.name}</span>
            {renderPrice ? renderPrice(mat) : <span className="text-xs text-yellow-400 font-mono">{formatYang(priceOf(mat.id))}</span>}
            <input type="checkbox" checked={on} onChange={() => onToggle(mat.id)} className="accent-yellow-400 w-4 h-4 cursor-pointer" title={mat.name} />
          </div>
        )
      })}
    </div>
  )
}
