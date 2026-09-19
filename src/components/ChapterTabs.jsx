import { useState } from 'react'
import EditChapterModal from './EditChapterModal'
import ItemImage from './ItemImage'
import { itemImages as materialImages } from '../utils/itemImages'

// Chapter row shown above the Materials/PVP tabs. Clicking the selected chapter
// again deselects it. For admins each chapter has an edit button (name +
// visibility) and, while selected, an "add existing materials" panel whose
// picks are saved immediately and which stays open for quick multi-picks.
export default function ChapterTabs({ chapters, active, onSelect, materials, members, onToggleMember, onUpdateChapter, isAdmin, horizontal }) {
  const [editing, setEditing] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  if (chapters.length === 0) return null

  const activeChapter = chapters.find(c => c.id === active) ?? null
  const activeMembers = activeChapter ? (members[activeChapter.id] ?? new Set()) : new Set()
  const box = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-600'

  const q = search.trim().toLowerCase()
  const pickable = activeChapter
    ? materials.filter(m => !q || m.name.toLowerCase().includes(q))
    : []

  return (
    <>
      <div className="flex flex-col gap-2 self-start max-w-full">
        <div className={`flex flex-wrap gap-1 border rounded-xl p-1 ${box}`}>
          {chapters.map(c => {
            const isActive = c.id === active
            return (
              <div key={c.id} className="relative group/chapter flex">
                <button
                  type="button"
                  onClick={() => { onSelect(isActive ? null : c.id); setPickerOpen(false); setSearch('') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isAdmin ? 'pr-7' : ''} ${
                    isActive
                      ? 'bg-yellow-400 text-gray-950'
                      : `text-gray-300 ${horizontal ? 'hover:bg-white/10' : 'hover:bg-gray-700'} ${c.visible ? '' : 'opacity-50'}`
                  }`}
                >
                  {c.name}{!c.visible && ' 🚫'}
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    title="Edit chapter"
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.7rem] leading-none transition-opacity ${isActive ? 'text-gray-950/70 hover:text-gray-950' : 'text-gray-500 hover:text-yellow-400'}`}
                  >
                    ✏️
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {isAdmin && activeChapter && (
          <button
            type="button"
            onClick={() => setPickerOpen(o => !o)}
            className={`self-start px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              pickerOpen ? 'bg-yellow-400 text-gray-950 border-yellow-400' : `text-gray-200 hover:border-yellow-400/50 ${box}`
            }`}
          >
            {pickerOpen ? 'Close' : '+ Add existing materials'}
          </button>
        )}
      </div>

      {isAdmin && activeChapter && pickerOpen && (
        <div className={`border rounded-xl p-3 flex flex-col gap-3 ${box}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-400 flex-1 min-w-[10rem]"
            />
            <span className="text-xs text-gray-400">
              {activeMembers.size} in {activeChapter.name} — click to add or remove
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {pickable.length === 0 && <p className="text-gray-500 text-sm p-2 col-span-full">No materials found.</p>}
            {pickable.map(m => {
              const inChapter = activeMembers.has(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggleMember(activeChapter.id, m.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-colors ${
                    inChapter
                      ? 'bg-yellow-400/15 border-yellow-400/60 text-yellow-100'
                      : 'bg-black/20 border-white/10 text-gray-300 hover:border-white/30'
                  }`}
                >
                  <span className="w-7 h-7 shrink-0 flex items-center justify-center">
                    {materialImages(m).length > 0
                      ? <ItemImage images={materialImages(m)} alt={m.name} className="w-full h-full object-contain" />
                      : <span className="text-lg">🧪</span>}
                  </span>
                  <span className="text-xs leading-tight line-clamp-2 flex-1">{m.name}</span>
                  {inChapter && <span className="text-yellow-400 text-xs shrink-0">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {editing && (
        <EditChapterModal chapter={editing} onClose={() => setEditing(null)} onSave={onUpdateChapter} />
      )}
    </>
  )
}
