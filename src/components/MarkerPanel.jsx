import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import ImageUpload from './ImageUpload'
import Spinner from './Spinner'

function extractStoragePath(url) {
  if (!url) return null
  const marker = '/object/public/map-notes/'
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

export default function MarkerPanel({ marker, onClose }) {
  const { isAdmin } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase
      .from('map_marker_notes')
      .select('*')
      .eq('marker_id', marker.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setNotes(data ?? [])
        setLoading(false)
      })
  }, [marker.id])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = comment.trim()
    if (!trimmed && !imageUrl) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('map_marker_notes')
      .insert({ marker_id: marker.id, comment: trimmed || null, image_url: imageUrl || null })
      .select()
      .single()
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setNotes(prev => [...prev, data])
      setComment('')
      setImageUrl('')
    }
    setSubmitting(false)
  }

  async function handleDeleteNote(note) {
    const path = extractStoragePath(note.image_url)
    if (path) await supabase.storage.from('map-notes').remove([path])
    const { error } = await supabase.from('map_marker_notes').delete().eq('id', note.id)
    if (error) { alert('Error: ' + error.message); return }
    setNotes(prev => prev.filter(n => n.id !== note.id))
  }

  return (
    <div
      className={`fixed right-0 top-0 h-full w-full sm:w-96 bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto transform transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-900">
        <div className="flex items-center gap-2 min-w-0">
          {marker.icon?.startsWith('/')
            ? <img src={marker.icon} alt="" className="w-7 h-7 object-contain shrink-0" />
            : <span className="text-2xl shrink-0">{marker.icon}</span>}
          <h2 className="text-lg font-bold text-white truncate">{marker.title || 'Marker'}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none shrink-0">×</button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-b border-gray-700 pb-4">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            maxLength={1000}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
          />
          <ImageUpload bucket="map-notes" onUploaded={setImageUrl} />
          {imageUrl && (
            <button type="button" onClick={() => setImageUrl('')} className="text-xs text-red-400 hover:text-red-300 self-start">
              Remove photo
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || (!comment.trim() && !imageUrl)}
            className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 text-sm transition-colors"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </form>

        {loading ? <Spinner /> : notes.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No comments yet. Be the first!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {notes.map(note => (
              <div key={note.id} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 relative">
                {note.comment && <p className="text-sm text-gray-200 whitespace-pre-wrap pr-6">{note.comment}</p>}
                {note.image_url && (
                  <img src={note.image_url} alt="" className="mt-2 max-h-40 rounded-lg border border-gray-700 object-contain" />
                )}
                <p className="text-xs text-gray-500 mt-2">{new Date(note.created_at).toLocaleString()}</p>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteNote(note)}
                    className="absolute top-2 right-2 text-gray-600 hover:text-red-400 text-sm"
                    title="Delete"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
