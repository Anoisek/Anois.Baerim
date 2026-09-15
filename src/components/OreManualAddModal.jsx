import { useEffect, useRef, useState } from 'react'
import TurnstileWidget from './TurnstileWidget'
import { isOreAddWindowOpen, nextOreAddWindowOpensAt } from '../utils/oreFinderWindow'

// In-game screenshots show a "Coordinates: X, Y" line under the minimap -
// same pixel space as our stored ore positions (see the mococko-project
// cross-reference), so reading that line straight off the image gives an
// exact placement without anyone having to eyeball a click.
async function extractCoordinatesFromImage(file) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    const { data: { text } } = await worker.recognize(file)
    const match = text.match(/Coordinates?\s*:?\s*(\d+)\D+(\d+)/i)
    if (!match) return null
    return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) }
  } finally {
    await worker.terminate()
  }
}

export default function OreManualAddModal({ map, isAdmin, onClose, onSubmit, sending, t }) {
  const [xInput, setXInput] = useState('')
  const [yInput, setYInput] = useState('')
  const [comment, setComment] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [ocrStatus, setOcrStatus] = useState('idle') // idle | reading | done | error
  const [windowOpen, setWindowOpen] = useState(() => isOreAddWindowOpen())
  const fileInputRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setWindowOpen(isOreAddWindowOpen()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  async function handleFile(file) {
    if (!file || !file.type?.startsWith('image/')) return
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setOcrStatus('reading')
    try {
      const coords = await extractCoordinatesFromImage(file)
      if (coords) {
        setXInput(String(coords.x))
        setYInput(String(coords.y))
        setOcrStatus('done')
      } else {
        setOcrStatus('error')
      }
    } catch {
      setOcrStatus('error')
    }
  }

  // A paste listener on `document` (rather than onPaste on a div) so Ctrl+V
  // works regardless of which element inside the modal currently has focus.
  useEffect(() => {
    function handlePaste(e) {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
      if (item) handleFile(item.getAsFile())
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  function handleFileInputChange(e) {
    const file = e.target.files[0]
    e.target.value = ''
    handleFile(file)
  }

  const xNum = Number(xInput)
  const yNum = Number(yInput)
  const validX = xInput !== '' && Number.isFinite(xNum) && xNum >= 0 && xNum <= map.width
  const validY = yInput !== '' && Number.isFinite(yNum) && yNum >= 0 && yNum <= map.height
  const canSubmitWindow = windowOpen || isAdmin
  const canSubmit = validX && validY && !!turnstileToken && !sending && canSubmitWindow

  const remainingMs = canSubmitWindow ? 0 : Math.max(0, nextOreAddWindowOpensAt().getTime() - Date.now())
  const remainingMinutes = Math.floor(remainingMs / 60000)
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000)

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit((xNum / map.width) * 100, (yNum / map.height) * 100, comment.trim(), turnstileToken)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 flex flex-col items-center gap-3 shadow-xl shadow-black/50 max-h-[90vh] overflow-y-auto"
      >
        <p className="text-xl font-extrabold text-yellow-400 tracking-wide">{t('oreFinder.manualTitle')}</p>

        <div className="grid grid-cols-2 gap-3 w-full">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            X
            <input
              type="number"
              value={xInput}
              onChange={e => setXInput(e.target.value)}
              min={0}
              max={map.width}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Y
            <input
              type="number"
              value={yInput}
              onChange={e => setYInput(e.target.value)}
              min={0}
              max={map.height}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border border-dashed border-gray-600 hover:border-yellow-400 rounded-lg px-3 py-3 flex flex-col items-center gap-1.5 text-center transition-colors"
        >
          {imagePreview ? (
            <img src={imagePreview} alt="" className="max-h-24 rounded object-contain" />
          ) : (
            <span className="text-2xl">📋</span>
          )}
          <span className="text-[11px] text-gray-400">{t('oreFinder.manualImageHint')}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInputChange} />

        {ocrStatus === 'reading' && <p className="text-xs text-gray-400">{t('oreFinder.manualImageReading')}</p>}
        {ocrStatus === 'done' && <p className="text-xs text-green-400">{t('oreFinder.manualImageSuccess')}</p>}
        {ocrStatus === 'error' && <p className="text-xs text-red-400">{t('oreFinder.manualImageError')}</p>}

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value.slice(0, 200))}
          placeholder={t('oreFinder.commentPlaceholder')}
          rows={2}
          maxLength={200}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400 resize-none"
        />

        {!canSubmitWindow && (
          <p className="text-xs text-gray-500 text-center">
            {t('oreFinder.manualWindowClosed')}{' '}
            <span className="font-mono text-gray-300 font-semibold">
              {remainingMinutes}:{String(remainingSeconds).padStart(2, '0')}
            </span>
          </p>
        )}

        <TurnstileWidget onToken={setTurnstileToken} />

        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
          >
            {t('oreFinder.confirmCancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400 text-gray-950 transition-colors"
          >
            {t('oreFinder.manualOkButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
