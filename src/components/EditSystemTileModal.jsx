import { useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'
import IconDbPicker from './IconDbPicker'
import { deleteImages } from '../utils/imageStorage'

export default function EditSystemTileModal({ tileKey, defaultName, defaultEmoji, currentName, currentIcon, onClose, onSaved }) {
  const [name, setName] = useState(currentName)
  const [iconUrl, setIconUrl] = useState(currentIcon)
  const [saving, setSaving] = useState(false)

  async function handleIconChosen(url) {
    if (iconUrl) await deleteImages(iconUrl)
    setIconUrl(url)
  }

  async function handleRemoveIcon() {
    if (iconUrl) await deleteImages(iconUrl)
    setIconUrl('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    await Promise.all([
      db.from('settings').upsert({ key: `system_${tileKey}_name`, value: name.trim() }),
      db.from('settings').upsert({ key: `system_${tileKey}_icon`, value: iconUrl }),
    ])

    onSaved({ name: name.trim(), icon: iconUrl })
    onClose()
    setSaving(false)
  }

  return (
    <Modal title={`Edit "${defaultName}" tile`} onClose={onClose}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={defaultName}
            autoFocus
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
          <p className="text-xs text-gray-500">Leave empty to use the default name ("{defaultName}").</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Icon</label>
          {iconUrl ? (
            <div className="flex items-center gap-3">
              <img src={iconUrl} alt="" className="w-12 h-12 object-contain rounded-lg border border-gray-600" />
              <button type="button" onClick={handleRemoveIcon} className="text-sm text-red-400 hover:text-red-300">
                Remove (use default {defaultEmoji})
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{defaultEmoji}</span>
              <span className="text-xs text-gray-500">Default icon — pick an image below to override</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <ImageUpload onUploaded={handleIconChosen} />
            <IconDbPicker onUploaded={handleIconChosen} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </Modal>
  )
}
