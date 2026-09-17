import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function isPipSupported() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

function copyStyles(pipWindow) {
  ;[...document.styleSheets].forEach(styleSheet => {
    try {
      const cssRules = [...styleSheet.cssRules].map(rule => rule.cssText).join('')
      const style = document.createElement('style')
      style.textContent = cssRules
      pipWindow.document.head.appendChild(style)
    } catch {
      if (styleSheet.href) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.type = styleSheet.type
        link.media = styleSheet.media
        link.href = styleSheet.href
        pipWindow.document.head.appendChild(link)
      }
    }
  })
}

// Same Document Picture-in-Picture approach as MapPipButton, but with the
// full click-to-report flow (confirm+comment modal, remove confirm) ported
// into the popped-out window too, since that content lives in a separate
// document a plain portal to the main page's overlay can't reach.
//
// Turnstile is the one piece that can't be ported in: Cloudflare's checks
// fail inside a Document PiP window (it's an auxiliary browsing context),
// and once that window has focus the opener tab itself goes
// `document.visibilityState === 'hidden'` in this browser, which stalls the
// widget outright rather than just slowing it down. So the parent keeps a
// Turnstile widget solved and fresh in the real page window at all times and
// hands down whatever token is currently warm as `pipToken` - this component
// just waits on it and uses it for the send call.
export default function OreFinderPipButton({ map, ore, windowOpen, isAdmin, onSend, onRemove, pipToken, t }) {
  const [pipWindow, setPipWindow] = useState(null)
  const [pendingClick, setPendingClick] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [sending, setSending] = useState(false)
  const [hoverPos, setHoverPos] = useState(null)
  const supported = isPipSupported()

  useEffect(() => {
    if (!pipWindow) return
    function handlePageHide() {
      setPipWindow(null)
    }
    pipWindow.addEventListener('pagehide', handlePageHide)
    return () => pipWindow.removeEventListener('pagehide', handlePageHide)
  }, [pipWindow])

  useEffect(() => {
    if (pipWindow) pipWindow.close()
  }, [map.id])

  useEffect(() => {
    setConfirmRemove(false)
  }, [ore?.id])

  async function openPip() {
    if (pipWindow) {
      pipWindow.focus()
      return
    }
    const pip = await window.documentPictureInPicture.requestWindow({
      width: 420,
      height: 480,
    })
    pip.document.title = map.name
    pip.document.body.style.margin = '0'
    pip.document.body.style.background = '#030712'
    copyStyles(pip)
    setPipWindow(pip)
  }

  function handleMapClick(e) {
    if (!windowOpen || ore) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos(null)
    setCommentDraft('')
    setPendingClick({ x, y })
  }

  function handleMapMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos({ x, y, clientX: e.clientX, clientY: e.clientY })
  }

  function handleMapMouseLeave() {
    setHoverPos(null)
  }

  async function handleSend() {
    if (!pendingClick || sending || !pipToken) return
    setSending(true)
    const ok = await onSend(pendingClick.x, pendingClick.y, commentDraft.trim(), pipToken)
    setSending(false)
    if (ok) {
      setPendingClick(null)
      setCommentDraft('')
    }
  }

  async function handleRemove() {
    setConfirmRemove(false)
    await onRemove()
  }

  if (!supported) return null

  return (
    <>
      <button
        onClick={openPip}
        title={t('maps.pipTooltip')}
        className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
      >
        🗗 {t('maps.pipButton')}
      </button>
      {pipWindow && createPortal(
        <div style={{ padding: 12, color: '#e5e7eb', boxSizing: 'border-box' }}>
          <div className="flex items-center justify-between mb-2">
            <strong className="text-sm text-gray-100">{map.name}</strong>
          </div>
          <div
            onClick={handleMapClick}
            onMouseMove={handleMapMouseMove}
            onMouseLeave={handleMapMouseLeave}
            className={`relative w-full rounded-xl overflow-hidden border border-gray-700 bg-gray-950 ${
              windowOpen && !ore ? 'cursor-crosshair' : 'cursor-default'
            }`}
            style={{ aspectRatio: `${map.width} / ${map.height}` }}
          >
            <img
              src={map.image_url}
              alt={map.name}
              draggable="false"
              className="w-full h-full object-contain select-none pointer-events-none"
            />
            {ore && (
              <button
                onClick={e => { if (isAdmin) { e.stopPropagation(); setConfirmRemove(true) } }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform ${isAdmin ? 'hover:scale-125' : 'cursor-default'}`}
                style={{ left: `${ore.x}%`, top: `${ore.y}%` }}
              >
                <span className="text-3xl leading-none drop-shadow">🪨</span>
              </button>
            )}
          </div>
          {!ore && (
            <p className={`mt-2 text-xs ${windowOpen ? 'text-yellow-400' : 'text-gray-500'}`}>
              {windowOpen ? t('oreFinder.clickToMark') : t('oreFinder.addWindowClosed')}
            </p>
          )}

          {hoverPos && !pendingClick && !confirmRemove && (
            <div
              className="fixed z-20 pointer-events-none rounded-md border border-gray-600 bg-gray-900/90 px-2 py-1 text-[11px] font-mono text-gray-100 shadow-lg whitespace-nowrap"
              style={{ left: hoverPos.clientX + 14, top: hoverPos.clientY + 14 }}
            >
              X: {Math.round((hoverPos.x / 100) * map.width)} Y: {Math.round((hoverPos.y / 100) * map.height)}
            </div>
          )}

          {pendingClick && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setPendingClick(null)}
            >
              <div
                onClick={e => e.stopPropagation()}
                className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-72 flex flex-col items-center gap-3 shadow-xl shadow-black/50"
              >
                <p className="text-lg font-extrabold text-yellow-400 tracking-wide">{t('oreFinder.confirmTitle')}</p>
                <textarea
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value.slice(0, 200))}
                  placeholder={t('oreFinder.commentPlaceholder')}
                  rows={2}
                  maxLength={200}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400 resize-none"
                />
                <p className={`text-xs ${pipToken ? 'text-green-400' : 'text-gray-500'}`}>
                  {pipToken ? `✅ ${t('oreFinder.pipVerified')}` : t('oreFinder.pipVerifying')}
                </p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setPendingClick(null)}
                    className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
                  >
                    {t('oreFinder.confirmCancel')}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !pipToken}
                    className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400 text-gray-950 transition-colors"
                  >
                    {t('oreFinder.confirmSend')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {confirmRemove && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmRemove(false)}
            >
              <div
                onClick={e => e.stopPropagation()}
                className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-64 flex flex-col items-center gap-3 shadow-xl shadow-black/50"
              >
                <p className="text-base font-bold text-gray-100 text-center">{t('oreFinder.confirmStillThereTitle')}</p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={handleRemove}
                    className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-colors"
                  >
                    {t('oreFinder.confirmStillThereNo')}
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
                  >
                    {t('oreFinder.confirmStillThereYes')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>,
        pipWindow.document.body
      )}
    </>
  )
}
