import { useState } from 'react'
import Modal from './Modal'

// Lets the admin reuse an icon already uploaded for another bonus item instead of
// re-uploading or re-searching the icon database. Picked icons point at the SAME
// image_url as the original (no re-upload/duplicate file) — callers must avoid
// physically deleting an image out from under another row still using it (see
// isImageUsedElsewhere in Bonuses.jsx).
export default function ExistingImagePicker({ images, onUploaded }) {
  const [open, setOpen] = useState(false)

  if (!images || images.length === 0) return null

  function pick(url) {
    onUploaded(url)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-gray-800 border border-dashed border-gray-500 hover:border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-400 hover:text-white text-center transition-colors"
      >
        Choose from added icons
      </button>

      {open && (
        <Modal title="Icons already added" onClose={() => setOpen(false)} maxWidthClass="max-w-3xl">
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[60vh] overflow-y-auto content-start pr-1">
            {images.map(url => (
              <button
                key={url}
                type="button"
                onClick={() => pick(url)}
                className="aspect-square bg-gray-800 border border-gray-700 hover:border-yellow-400 rounded-md flex items-center justify-center p-1 transition-colors"
              >
                <img src={url} alt="" loading="lazy" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
