import { useState } from 'react'
import { uploadImage } from '../utils/imageStorage'

// Uploads an image straight from the clipboard (e.g. a screenshot or a copied
// icon) and hands back its URL — an alternative to picking a file.
export default function PasteImageButton({ onUploaded, className, label = '📋' }) {
  const [busy, setBusy] = useState(false)

  async function paste() {
    let blob = null
    try {
      for (const entry of await navigator.clipboard.read()) {
        const type = entry.types.find(t => t.startsWith('image/'))
        if (type) { blob = await entry.getType(type); break }
      }
    } catch {
      alert('Could not read the clipboard — allow clipboard access for this site and try again.')
      return
    }
    if (!blob) {
      alert('No image in the clipboard. Copy an image first (e.g. right-click → Copy image).')
      return
    }
    setBusy(true)
    try {
      const ext = blob.type.split('/')[1] || 'png'
      onUploaded(await uploadImage(new File([blob], `pasted.${ext}`, { type: blob.type })))
    } catch (error) {
      alert('Upload failed: ' + error.message)
    }
    setBusy(false)
  }

  return (
    <button type="button" onClick={paste} disabled={busy} title="Paste image from clipboard" className={className}>
      {busy ? '…' : label}
    </button>
  )
}
