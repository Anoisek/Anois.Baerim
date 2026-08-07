import { Link } from 'react-router-dom'
import ReorderButtons from './ReorderButtons'

export default function Tile({ to, image, emoji, label, dashed, onClick, onEdit, reorder }) {
  const cls = `group relative bg-gray-900/80 border ${dashed ? 'border-dashed border-gray-600' : 'border-gray-700'} rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-200 hover:border-yellow-400/50 hover:bg-gray-800/80 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5`

  const inner = (
    <>
      <div className="w-16 h-16 flex items-center justify-center">
        {image
          ? <img src={image} alt={label} className="w-full h-full object-contain drop-shadow" />
          : <span className="text-4xl">{emoji}</span>}
      </div>
      <span className={`text-sm font-semibold text-center leading-tight ${dashed ? 'text-gray-400 group-hover:text-white' : 'text-gray-100'} transition-colors`}>
        {label}
      </span>
      {onEdit && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
          className="absolute top-2 right-2 text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-base"
          title="Edit"
        >
          ✏️
        </button>
      )}
      {reorder && <ReorderButtons {...reorder} />}
    </>
  )

  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>
  return <Link to={to} className={cls}>{inner}</Link>
}
