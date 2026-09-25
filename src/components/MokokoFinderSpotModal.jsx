import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { deleteImages } from '../utils/imageStorage'
import { deleteMarkerForSpot } from '../utils/mokokoFinderMarkers'

// Public view of an approved mokoko spot (delete is admin-only): its own screenshot plus any
// extra photos merged in from other reports of the same sighting (see
// MokokoFinderReviewModal's merge flow) - each one is a "comment" proving the
// sighting. Deleting removes the spot, its notes, its interactive-map marker,
// and every photo from R2.
export default function MokokoFinderSpotModal({ spot, isAdmin, onClose, onDeleted }) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [zoomUrl, setZoomUrl] = useState(null)

  useEffect(() => {
    db.from('mokoko_finder_spot_notes').select('*').eq('spot_id', spot.id).order('created_at').then(({ data }) => {
      setNotes(data ?? [])
      setLoading(false)
    })
  }, [spot.id])

  async function handleDelete() {
    setDeleting(true)
    await deleteMarkerForSpot(spot.marker_id)
    await db.from('mokoko_finder_spot_notes').delete().eq('spot_id', spot.id)
    await db.from('mokoko_finder_spots').delete().eq('id', spot.id)
    await deleteImages([spot.screenshot_url, ...notes.map(n => n.image_url)], 'map-notes')
    setDeleting(false)
    onDeleted(spot)
  }

  const photos = [spot.screenshot_url, ...notes.map(n => n.image_url)]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md flex flex-col gap-3 shadow-xl shadow-black/50 max-h-[85vh]"
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-extrabold text-yellow-400 tracking-wide">🍀 {t('mokokoFinder.spotTitle')}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">{t('mokokoFinder.loading')}</p>
        ) : (
          <div className="flex flex-wrap gap-2 overflow-y-auto">
            {photos.map((url, i) => (
              <button key={i} onClick={() => setZoomUrl(url)}>
                <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
              </button>
            ))}
          </div>
        )}
        {photos.length > 1 && <p className="text-xs text-gray-500">{t('mokokoFinder.photoCount', { count: photos.length })}</p>}

        {isAdmin && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white transition-colors"
        >
          {t('mokokoFinder.deleteSpotButton')}
        </button>
        )}
      </div>

      {zoomUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={e => { e.stopPropagation(); setZoomUrl(null) }}
        >
          <img src={zoomUrl} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
