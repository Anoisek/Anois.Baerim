// Multi-select of chapters for the Add/Edit material modals.
export default function ChapterCheckboxes({ chapters, selected, onChange }) {
  if (chapters.length === 0) return null

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">Chapters (not shown on the tile)</label>
      <div className="flex flex-wrap gap-2">
        {chapters.map(c => (
          <label
            key={c.id}
            className="flex items-center gap-2 cursor-pointer select-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={() => toggle(c.id)}
              className="accent-yellow-400 w-4 h-4"
            />
            <span className="text-sm text-gray-200">{c.name}{!c.visible && ' 🚫'}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
