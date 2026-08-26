import { Link } from 'react-router-dom'
import { rawItemName } from '../utils/itemName'
import { slugify } from '../utils/slug'

export default function MaterialTile({ mat, quantity, kind }) {
  const to = kind === 'item' ? `/chapter/${mat.category_id}/item/${slugify(rawItemName(mat))}` : `/materials/${slugify(mat.name)}`
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 p-3 bg-gray-800/60 border border-gray-700 rounded-xl hover:border-yellow-400/50 hover:bg-gray-800 transition-colors">
      <div className="w-12 h-12 shrink-0 flex items-center justify-center">
        {mat.image_url
          ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain" />
          : <span className="text-2xl">{kind === 'item' ? '⚔️' : '🧪'}</span>}
      </div>
      <span className="text-xs text-gray-300 text-center leading-tight">{mat.name}</span>
      <span className="text-yellow-400 text-sm font-bold font-mono">×{quantity}</span>
    </Link>
  )
}
