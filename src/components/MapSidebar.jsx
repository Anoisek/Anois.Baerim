import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReorderButtons from './ReorderButtons'
import { MAP_CHAPTERS, mapChapterOf } from '../utils/mapChapters'

// Map list grouped into collapsible Chapter I / Chapter II sections. The chapter
// holding the selected map opens automatically, the others stay collapsed until
// clicked. Shared by the regular and the horizontal Maps pages.
export default function MapSidebar({ maps, selectedMap, mapStats, isAdmin, onSelect, onMove, onEdit, onAdd, horizontal }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => new Set())
  const selectedChapter = selectedMap ? mapChapterOf(selectedMap) : null

  useEffect(() => {
    if (selectedChapter == null) return
    setOpen(prev => (prev.has(selectedChapter) ? prev : new Set(prev).add(selectedChapter)))
  }, [selectedChapter, selectedMap?.id])

  function toggle(id) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const idle = horizontal
    ? 'bg-black/20 border-white/10 hover:bg-black/30 text-gray-200'
    : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800 text-gray-200'
  const headerIdle = horizontal
    ? 'bg-black/30 border-white/10 hover:bg-black/40'
    : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
  const addBtn = horizontal
    ? 'border-white/15 hover:border-white/30'
    : 'border-gray-600 hover:border-gray-400'

  return (
    <aside className="w-full md:w-56 shrink-0 flex flex-col gap-2 md:max-h-[70vh] md:overflow-y-auto pb-1 md:pb-0">
      {MAP_CHAPTERS.map(chapter => {
        const group = maps.filter(m => mapChapterOf(m) === chapter.id)
        const isOpen = open.has(chapter.id)
        let done = 0
        let total = 0
        for (const m of group) {
          const s = mapStats(m.id)
          done += s.done
          total += s.total
        }
        return (
          <div key={chapter.id} className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => toggle(chapter.id)}
              aria-expanded={isOpen}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-bold text-gray-100 border transition-colors ${headerIdle}`}
            >
              <span className="flex items-center gap-2">
                <span className={`text-[10px] text-yellow-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                {chapter.name}
              </span>
              <span className="text-[10px] font-mono font-bold text-gray-400">{group.length > 0 ? `${done}/${total}` : '—'}</span>
            </button>

            {isOpen && (
              <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 md:pl-2">
                {group.length === 0 && (
                  <p className="text-xs text-gray-500 px-2 py-1">{t('maps.noMapsYet')}</p>
                )}
                {group.map((m, index) => {
                  const active = m.id === selectedMap?.id
                  const { total: mTotal, done: mDone } = mapStats(m.id)
                  const complete = mTotal > 0 && mDone === mTotal
                  const statColor = mTotal === 0
                    ? (active ? 'text-gray-700' : 'text-gray-500')
                    : complete
                      ? (active ? 'text-green-700' : 'text-green-400')
                      : (active ? 'text-red-700' : 'text-red-400')
                  const isMaxed = m.max_mokoko != null && mTotal >= m.max_mokoko
                  return (
                    <div key={m.id} className="relative shrink-0 md:shrink group">
                      <button
                        onClick={() => onSelect(m)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border whitespace-nowrap md:whitespace-normal ${
                          active ? 'bg-yellow-400 border-yellow-400 text-gray-950' : idle
                        }`}
                      >
                        <div className={`flex items-center justify-between gap-2 ${isAdmin ? 'pr-5 pl-6' : ''}`}>
                          <span className="flex items-center gap-1 min-w-0">
                            {isMaxed && (
                              <span className={active ? 'text-gray-900' : 'text-yellow-400'} title={t('maps.maxReachedTooltip')}>★</span>
                            )}
                            {m.admin_only && (
                              <span className={active ? 'text-gray-900' : 'text-gray-500'} title={t('maps.adminOnlyTooltip')}>🔒</span>
                            )}
                            <span className="font-semibold truncate">{m.name}</span>
                          </span>
                          <span className={`text-[10px] font-mono font-bold shrink-0 ${statColor}`}>{mDone}/{mTotal}</span>
                        </div>
                        <div className={`text-xs ${active ? 'text-gray-800' : 'text-gray-500'} ${isAdmin ? 'pl-6' : ''}`}>{m.region}</div>
                      </button>
                      {isAdmin && (
                        <ReorderButtons
                          onUp={() => onMove(m, -1)}
                          onDown={() => onMove(m, 1)}
                          disableUp={index === 0}
                          disableDown={index === group.length - 1}
                        />
                      )}
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); onEdit(m) }}
                          title={t('maps.editMapTooltip')}
                          className={`absolute top-1.5 right-1.5 text-xs opacity-60 hover:opacity-100 ${active ? 'text-gray-800' : 'text-gray-300'}`}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      {isAdmin && (
        <button
          onClick={onAdd}
          className={`shrink-0 md:shrink text-left px-3 py-2 rounded-lg text-sm border border-dashed text-gray-400 hover:text-white transition-colors ${addBtn}`}
        >
          {t('maps.addMap')}
        </button>
      )}
    </aside>
  )
}
