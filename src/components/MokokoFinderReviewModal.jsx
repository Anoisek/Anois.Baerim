import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { deleteImages } from '../utils/imageStorage'

function formatTime(iso) {
  return new Date(iso).toLocaleString()
}

// Admin-only review queue for /mokoko-finder reports. Selecting one or more
// reports and confirming lets the admin type the final exact coordinates
// (several people often report the same mokoko slightly off from each
// other) - that creates one mokoko_finder_spots row there, the first
// selected report's screenshot becomes its own screenshot_url, and every
// other selected report's screenshot is kept as a comment/photo via
// mokoko_finder_spot_notes. Rejecting a single report just deletes it (and
// its screenshot).
export default function MokokoFinderReviewModal({ map, onClose, onApproved }) {
  const { t } = useTranslation()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [zoomUrl, setZoomUrl] = useState(null)
  const [selected, setSelected] = useState({})
  const [merging, setMerging] = useState(null) // { reports, xInput, yInput } | null
  const [mergeSending, setMergeSending] = useState(false)

  useEffect(() => {
    db.from('mokoko_finder_reports').select('*').eq('map', map.name).order('created_at').then(({ data }) => {
      setReports(data ?? [])
      setLoading(false)
    })
  }, [map.name])

  function toggleSelect(id) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const selectedReports = reports.filter(r => selected[r.id])

  function openMerge() {
    if (selectedReports.length === 0) return
    const avgX = selectedReports.reduce((sum, r) => sum + r.x, 0) / selectedReports.length
    const avgY = selectedReports.reduce((sum, r) => sum + r.y, 0) / selectedReports.length
    setMerging({
      reports: selectedReports,
      xInput: String(Math.round((avgX / 100) * map.width)),
      yInput: String(Math.round((avgY / 100) * map.height)),
    })
  }

  async function handleConfirmMerge() {
    if (!merging) return
    const xNum = Number(merging.xInput)
    const yNum = Number(merging.yInput)
    if (!Number.isFinite(xNum) || xNum < 0 || xNum > map.width) return
    if (!Number.isFinite(yNum) || yNum < 0 || yNum > map.height) return

    setMergeSending(true)
    const [primary, ...rest] = merging.reports
    const { data: spot, error } = await db
      .from('mokoko_finder_spots')
      .insert({
        map: map.name,
        x: (xNum / map.width) * 100,
        y: (yNum / map.height) * 100,
        screenshot_url: primary.screenshot_url,
      })
      .select()
      .single()
    if (error) {
      alert(t('mokokoFinder.approveError', { message: error.message }))
      setMergeSending(false)
      return
    }

    for (const report of rest) {
      await db.from('mokoko_finder_spot_notes').insert({ spot_id: spot.id, image_url: report.screenshot_url })
    }

    const mergedIds = new Set(merging.reports.map(r => r.id))
    for (const id of mergedIds) {
      await db.from('mokoko_finder_reports').delete().eq('id', id)
    }

    setReports(prev => prev.filter(r => !mergedIds.has(r.id)))
    setSelected(prev => {
      const next = { ...prev }
      for (const id of mergedIds) delete next[id]
      return next
    })
    setMergeSending(false)
    setMerging(null)
    onApproved(spot)
  }

  async function handleReject(report) {
    setBusyId(report.id)
    await db.from('mokoko_finder_reports').delete().eq('id', report.id)
    await deleteImages(report.screenshot_url, 'map-notes')
    setReports(prev => prev.filter(r => r.id !== report.id))
    setBusyId(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl flex flex-col gap-4 shadow-xl shadow-black/50 max-h-[85vh]"
      >
        <div className="flex items-center justify-between">
          <p className="text-xl font-extrabold text-yellow-400 tracking-wide">🍀 {t('mokokoFinder.reviewTitle')}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">{t('mokokoFinder.loading')}</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-500">{t('mokokoFinder.noReports')}</p>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 -mx-2 px-2 flex flex-col gap-2">
              {reports.map(report => {
                const px = Math.round((report.x / 100) * map.width)
                const py = Math.round((report.y / 100) * map.height)
                const busy = busyId === report.id
                return (
                  <div
                    key={report.id}
                    className={`flex items-center gap-3 border rounded-xl p-2.5 transition-colors ${
                      selected[report.id] ? 'bg-yellow-400/10 border-yellow-400/50' : 'bg-gray-800/60 border-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[report.id]}
                      onChange={() => toggleSelect(report.id)}
                      className="w-4 h-4 shrink-0 accent-yellow-400"
                    />
                    <button onClick={() => setZoomUrl(report.screenshot_url)} className="shrink-0">
                      <img
                        src={report.screenshot_url}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg border border-gray-600"
                      />
                    </button>
                    <div className="flex-1 min-w-0 text-xs text-gray-300">
                      <p className="font-mono font-semibold text-gray-100">X: {px} Y: {py}</p>
                      <p className="text-gray-500">{formatTime(report.created_at)}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleReject(report)}
                        disabled={busy}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition-colors"
                      >
                        {t('mokokoFinder.rejectButton')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-400">{t('mokokoFinder.selectedCount', { count: selectedReports.length })}</p>
              <button
                onClick={openMerge}
                disabled={selectedReports.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-gray-950 transition-colors"
              >
                {selectedReports.length > 1
                  ? t('mokokoFinder.mergeApproveButton', { count: selectedReports.length })
                  : t('mokokoFinder.approveButton')}
              </button>
            </div>
          </>
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

      {merging && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !mergeSending && setMerging(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 flex flex-col items-center gap-3 shadow-xl shadow-black/50"
          >
            <p className="text-lg font-bold text-yellow-400 text-center">
              {merging.reports.length > 1
                ? t('mokokoFinder.mergeTitleMultiple', { count: merging.reports.length })
                : t('mokokoFinder.mergeTitleSingle')}
            </p>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {merging.reports.map(r => (
                <img key={r.id} src={r.screenshot_url} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-600" />
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center">{t('mokokoFinder.mergeCoordsHint')}</p>
            <div className="grid grid-cols-2 gap-3 w-full">
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                X
                <input
                  type="number"
                  value={merging.xInput}
                  onChange={e => setMerging(prev => ({ ...prev, xInput: e.target.value }))}
                  min={0}
                  max={map.width}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                Y
                <input
                  type="number"
                  value={merging.yInput}
                  onChange={e => setMerging(prev => ({ ...prev, yInput: e.target.value }))}
                  min={0}
                  max={map.height}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                />
              </label>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setMerging(null)}
                disabled={mergeSending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 disabled:opacity-40 transition-colors"
              >
                {t('mokokoFinder.cancelButton')}
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={mergeSending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-gray-950 transition-colors"
              >
                {t('mokokoFinder.approveButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
