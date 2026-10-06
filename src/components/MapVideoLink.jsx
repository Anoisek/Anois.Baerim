import { useEffect, useState } from 'react'
import { db } from '../dbClient'

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.5 6.9a.75.75 0 00-1.1.66v4.88a.75.75 0 001.1.66l4.2-2.44a.75.75 0 000-1.3L8.5 6.9z" clipRule="evenodd" />
    </svg>
  )
}

// Per-map video link, shown inline next to the map name. Admins can set/clear
// it for each map in place; everyone else only sees the link once it's filled in.
export default function MapVideoLink({ map, isAdmin, onUpdated, t }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(map.video_url ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditing(false)
    setValue(map.video_url ?? '')
  }, [map.id, map.video_url])

  async function save() {
    setSaving(true)
    const { data, error } = await db.from('maps').update({ video_url: value.trim() || null }).eq('id', map.id).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onUpdated(data)
    setEditing(false)
  }

  if (editing) {
    return (
      <form
        onSubmit={e => { e.preventDefault(); save() }}
        className="flex items-center gap-1.5"
      >
        <input
          autoFocus
          type="url"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) } }}
          placeholder="https://youtube.com/..."
          className="w-56 px-2.5 py-1 rounded-lg text-xs bg-gray-900 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-yellow-400/60"
        />
        <button
          type="submit"
          disabled={saving}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-yellow-400 text-gray-950 hover:bg-yellow-300 disabled:opacity-50 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
      </form>
    )
  }

  if (!map.video_url && !isAdmin) return null

  return (
    <div className="flex items-center gap-2">
      {map.video_url && (
        <a
          href={map.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-400 hover:text-yellow-300 hover:underline underline-offset-2 transition-colors"
        >
          <PlayIcon />
          {t('maps.checkVideo')}
        </a>
      )}
      {isAdmin && (
        <button
          onClick={() => setEditing(true)}
          title={map.video_url ? 'Edit video link' : 'Add video link'}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {map.video_url ? '✎' : '+ Video link'}
        </button>
      )}
    </div>
  )
}
