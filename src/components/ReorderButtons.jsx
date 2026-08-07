export default function ReorderButtons({ onUp, onDown, disableUp, disableDown }) {
  return (
    <div className="absolute top-2 left-2 flex flex-col gap-0.5 z-10">
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); onUp() }}
        disabled={disableUp}
        title="Move up"
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/90 border border-gray-600 text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none transition-colors"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); onDown() }}
        disabled={disableDown}
        title="Move down"
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/90 border border-gray-600 text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none transition-colors"
      >
        ▼
      </button>
    </div>
  )
}
