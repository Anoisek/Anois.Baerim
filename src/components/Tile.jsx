import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReorderButtons from './ReorderButtons'

export default function Tile({ to, image, emoji, label, sublabel, dashed, onClick, onEdit, reorder, maintenance, onToggleMaintenance, blocked }) {
  const { t } = useTranslation()
  const cls = `group relative bg-gray-900/80 border ${dashed ? 'border-dashed border-gray-600' : 'border-gray-700'} rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-200 ${
    blocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-400/50 hover:bg-gray-800/80 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5'
  }`

  const inner = (
    <>
      <div className="w-16 h-16 flex items-center justify-center">
        {image
          ? <img src={image} alt={label} loading="lazy" className="w-full h-full object-contain drop-shadow" />
          : <span className="text-4xl">{emoji}</span>}
      </div>
      <span className={`text-sm font-semibold text-center leading-tight ${dashed ? 'text-gray-400 group-hover:text-white' : 'text-gray-100'} transition-colors`}>
        {label}
      </span>
      {sublabel && (
        <span className="text-xs text-gray-500 text-center -mt-3">{sublabel}</span>
      )}
      {maintenance && (
        <span className="absolute inset-0 flex items-center justify-center bg-gray-950/70 rounded-2xl pointer-events-none">
          <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
            🚧 {t('common.inProgress')}
          </span>
        </span>
      )}
      {onEdit && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
          className="absolute top-2 right-2 text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-base z-10"
          title={t('common.edit')}
        >
          ✏️
        </button>
      )}
      {reorder && <ReorderButtons {...reorder} />}
      {onToggleMaintenance && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleMaintenance() }}
          className={`absolute bottom-2 right-2 text-xs px-1.5 py-1 rounded-full border transition-colors z-10 ${
            maintenance ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-gray-800/90 border-gray-600 text-gray-300 hover:text-yellow-400'
          }`}
          title={maintenance ? t('common.endMaintenance') : t('common.markInProgress')}
        >
          🚧
        </button>
      )}
    </>
  )

  if (blocked) return <div className={cls}>{inner}</div>
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>
  return <Link to={to} className={cls}>{inner}</Link>
}
