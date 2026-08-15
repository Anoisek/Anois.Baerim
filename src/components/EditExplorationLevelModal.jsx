import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'
import { deleteImages } from '../utils/imageStorage'

export default function EditExplorationLevelModal({ level, onClose, onSaved }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(level.title ?? '')
  const [description, setDescription] = useState(level.description ?? '')
  const [xPercent, setXPercent] = useState(String(level.x_percent))
  const [yPercent, setYPercent] = useState(String(level.y_percent))
  const [imageUrls, setImageUrls] = useState(level.image_urls ?? [])
  const [saving, setSaving] = useState(false)

  async function removeImageAt(i) {
    await deleteImages(imageUrls[i])
    setImageUrls(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    const x = Math.min(100, Math.max(0, parseFloat(xPercent) || 0))
    const y = Math.min(100, Math.max(0, parseFloat(yPercent) || 0))
    const { data, error } = await db
      .from('exploration_levels')
      .update({ title: title.trim() || null, description: description.trim() || null, x_percent: x, y_percent: y, image_urls: imageUrls })
      .eq('level', level.level)
      .select()
      .single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSaved(data)
    onClose()
  }

  return (
    <Modal title={t('systems.editLevel', { level: level.level })} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">{t('systems.levelTitleLabel')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('systems.levelTitlePlaceholder', { level: level.level })}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">{t('systems.levelDescriptionLabel')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('systems.levelDescriptionPlaceholder')}
            rows={8}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-sm text-gray-400">{t('systems.positionX')}</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={xPercent}
              onChange={e => setXPercent(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-sm text-gray-400">{t('systems.positionY')}</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={yPercent}
              onChange={e => setYPercent(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">{t('systems.positionHint')}</p>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">{t('systems.levelImagesLabel')}</label>
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
                  <button
                    type="button"
                    onClick={() => removeImageAt(i)}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <ImageUpload onUploaded={url => setImageUrls(prev => [...prev, url])} />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Modal>
  )
}
