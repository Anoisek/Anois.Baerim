import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

const MARKER_ICON = '/mokoko.png'

async function ensureInHallOfFame(nickname) {
  if (!nickname) return
  const { data: helpers } = await db.from('map_helpers').select('name, sort_order')
  const already = (helpers ?? []).some(h => h.name.trim().toLowerCase() === nickname.trim().toLowerCase())
  if (already) return
  const nextOrder = Math.max(0, ...(helpers ?? []).map(h => h.sort_order)) + 10
  await db.from('map_helpers').insert({ name: nickname.trim(), sort_order: nextOrder })
}

export default function AddMarkerModal({ mapId, x, y, nextNumber, onClose, onAdded }) {
  const { nickname } = useAuth()
  const { t } = useTranslation()
  const [imageUrl, setImageUrl] = useState('')
  const [delayDays, setDelayDays] = useState('0')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const days = Number(delayDays) || 0
    const visibleAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
    const { data, error } = await db
      .from('map_markers')
      .insert({ map_id: mapId, x, y, icon: MARKER_ICON, title: `Mokoko #${nextNumber}`, visible_at: visibleAt })
      .select()
      .single()
    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }
    if (imageUrl) {
      const { error: noteError } = await db.from('map_marker_notes').insert({ marker_id: data.id, image_url: imageUrl })
      if (noteError) alert('Marker added, but photo failed to attach: ' + noteError.message)
    }
    await ensureInHallOfFame(nickname)
    onAdded(data)
    onClose()
    setSaving(false)
  }

  return (
    <Modal title={t('addMarkerModal.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <img src={MARKER_ICON} alt="" className="w-12 h-12 object-contain" />
          <p className="text-sm font-semibold text-gray-200">Mokoko #{nextNumber}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">{t('addMarkerModal.photoOptional')}</label>
          <ImageUpload bucket="map-notes" onUploaded={setImageUrl} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">{t('addMarkerModal.delayLabel')}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={delayDays}
              onChange={e => setDelayDays(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
            />
            <span className="text-sm text-gray-400">{t('addMarkerModal.delayDays')}</span>
          </div>
          <p className="text-xs text-gray-500">{t('addMarkerModal.delayHint')}</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? t('addMarkerModal.saving') : t('addMarkerModal.addMarker')}
        </button>
      </form>
    </Modal>
  )
}
