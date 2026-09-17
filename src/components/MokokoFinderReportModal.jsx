import { useState } from 'react'
import ImageUpload from './ImageUpload'
import TurnstileWidget from './TurnstileWidget'

// Report form for /mokoko-finder: exact pixel coordinates (pre-filled from
// the map click, same convention as OreManualAddModal) plus a screenshot as
// proof - submitting drops it into the admin review queue, it doesn't appear
// on the map right away.
export default function MokokoFinderReportModal({ map, initialX, initialY, onClose, onSubmit, sending }) {
  const [xInput, setXInput] = useState(String(Math.round(initialX)))
  const [yInput, setYInput] = useState(String(Math.round(initialY)))
  const [screenshotUrl, setScreenshotUrl] = useState(null)
  const [turnstileToken, setTurnstileToken] = useState('')

  const xNum = Number(xInput)
  const yNum = Number(yInput)
  const validX = xInput !== '' && Number.isFinite(xNum) && xNum >= 0 && xNum <= map.width
  const validY = yInput !== '' && Number.isFinite(yNum) && yNum >= 0 && yNum <= map.height
  const canSubmit = validX && validY && !!screenshotUrl && !!turnstileToken && !sending

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit((xNum / map.width) * 100, (yNum / map.height) * 100, screenshotUrl, turnstileToken)
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
        <p className="text-xl font-extrabold text-yellow-400 tracking-wide">🍀 Zgłoś mokoko</p>

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

        <div className="w-full">
          <p className="text-xs text-gray-400 mb-1.5">Zrzut ekranu (dowód)</p>
          <ImageUpload bucket="map-notes" onUploaded={setScreenshotUrl} />
        </div>

        <TurnstileWidget onToken={setTurnstileToken} />

        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400 text-gray-950 transition-colors"
          >
            Wyślij
          </button>
        </div>
      </div>
    </div>
  )
}
