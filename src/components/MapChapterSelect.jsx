import { MAP_CHAPTERS } from '../utils/mapChapters'

export default function MapChapterSelect({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">Chapter</label>
      <div className="flex gap-2">
        {MAP_CHAPTERS.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold border transition-colors ${
              value === c.id
                ? 'bg-yellow-400 border-yellow-400 text-gray-950'
                : 'bg-gray-800 border-gray-600 text-gray-200 hover:border-yellow-400/50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
