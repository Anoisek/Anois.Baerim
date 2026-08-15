import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { formatItemName } from '../utils/itemName'

function ResultGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest px-1">{label}</span>
      {children}
    </div>
  )
}

function ResultRow({ image, emoji, name, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-colors text-left w-full">
      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
        {image ? <img src={image} alt={name} className="w-full h-full object-contain" /> : <span className="text-sm">{emoji}</span>}
      </div>
      <span className="text-sm text-gray-200 truncate">{name}</span>
    </button>
  )
}

const EMPTY_RESULTS = { chapters: [], categories: [], materials: [], items: [] }

export default function GlobalSearch() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(EMPTY_RESULTS)
      setLoading(false)
      return
    }
    setLoading(true)
    const timeout = setTimeout(() => {
      Promise.all([
        db.from('categories').select('id, name, image_url').ilike('name', `%${q}%`).limit(5),
        db.from('subcategories').select('id, name, image_url, category_id').ilike('name', `%${q}%`).limit(5),
        db.from('materials').select('id, name, image_url').ilike('name', `%${q}%`).limit(5),
        db.from('items').select('id, name, image_url, category_id').ilike('name', `%${q}%`).limit(5),
      ]).then(([chaptersRes, categoriesRes, materialsRes, itemsRes]) => {
        setResults({
          chapters: chaptersRes.data ?? [],
          categories: categoriesRes.data ?? [],
          materials: materialsRes.data ?? [],
          items: itemsRes.data ?? [],
        })
        setLoading(false)
      })
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  const hasResults = results.chapters.length + results.categories.length + results.materials.length + results.items.length > 0

  function go(to) {
    navigate(to)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-gray-400 hover:text-white transition-colors p-1.5"
        title={t('globalSearch.searchTooltip')}
      >
        🔍
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/40 z-50">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
            placeholder={t('globalSearch.placeholder')}
            className="w-full bg-gray-800 border-b border-gray-700 rounded-t-xl px-3 py-2 text-sm text-white focus:outline-none"
          />
          <div className="p-2 flex flex-col gap-3">
            {query.trim().length < 2 ? (
              <p className="text-xs text-gray-500 p-2">{t('globalSearch.typeAtLeast2')}</p>
            ) : loading ? (
              <p className="text-xs text-gray-500 p-2">{t('globalSearch.searching')}</p>
            ) : !hasResults ? (
              <p className="text-xs text-gray-500 p-2">{t('globalSearch.noResults')}</p>
            ) : (
              <>
                {results.chapters.length > 0 && (
                  <ResultGroup label={t('globalSearch.chapters')}>
                    {results.chapters.map(c => (
                      <ResultRow key={c.id} image={c.image_url} emoji="📦" name={c.name} onClick={() => go(`/chapter/${c.id}`)} />
                    ))}
                  </ResultGroup>
                )}
                {results.categories.length > 0 && (
                  <ResultGroup label={t('globalSearch.categories')}>
                    {results.categories.map(c => (
                      <ResultRow key={c.id} image={c.image_url} emoji="📦" name={c.name} onClick={() => go(`/chapter/${c.category_id}/sub/${c.id}`)} />
                    ))}
                  </ResultGroup>
                )}
                {results.materials.length > 0 && (
                  <ResultGroup label={t('globalSearch.materials')}>
                    {results.materials.map(m => (
                      <ResultRow key={m.id} image={m.image_url} emoji="🧪" name={m.name} onClick={() => go(`/materials/${m.id}`)} />
                    ))}
                  </ResultGroup>
                )}
                {results.items.length > 0 && (
                  <ResultGroup label={t('globalSearch.items')}>
                    {results.items.map(i => (
                      <ResultRow key={i.id} image={i.image_url} emoji="⚔️" name={formatItemName(i)} onClick={() => go(`/chapter/${i.category_id}/item/${i.id}`)} />
                    ))}
                  </ResultGroup>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
