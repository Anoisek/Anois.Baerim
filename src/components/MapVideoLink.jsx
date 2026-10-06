import { db } from '../dbClient'

// Per-map video link shown above the interactive map. Admins can set/clear it
// for each map; everyone else only sees the link once it's filled in.
export default function MapVideoLink({ map, isAdmin, onUpdated, t }) {
  async function editLink() {
    const input = window.prompt(t('maps.videoLinkPrompt'), map.video_url ?? '')
    if (input === null) return
    const value = input.trim() || null
    const { data, error } = await db.from('maps').update({ video_url: value }).eq('id', map.id).select().single()
    if (error) { alert('Error: ' + error.message); return }
    onUpdated(data)
  }

  if (!map.video_url && !isAdmin) return null

  return (
    <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
      {map.video_url && (
        <a
          href={map.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600/90 hover:bg-red-500 text-white transition-colors"
        >
          ▶ {t('maps.checkVideo')}
        </a>
      )}
      {isAdmin && (
        <button
          onClick={editLink}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
        >
          🎬 {map.video_url ? 'Edit video link' : 'Set video link'}
        </button>
      )}
    </div>
  )
}
