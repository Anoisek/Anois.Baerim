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

export default function MapPipButton({ map, markers, collected, onToggleCollected, doneCount, totalCount, t }) {
  const [pipWindow, setPipWindow] = useState(null)
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

  async function openPip() {
    if (pipWindow) {
      pipWindow.focus()
      return
    }
    const pip = await window.documentPictureInPicture.requestWindow({
      width: 420,
      height: 460,
    })
    pip.document.title = map.name
    pip.document.body.style.margin = '0'
    pip.document.body.style.background = '#030712'
    copyStyles(pip)
    setPipWindow(pip)
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
            <span className="text-xs text-gray-400">{doneCount}/{totalCount} {t('maps.collected')}</span>
          </div>
          <div
            className="relative w-full rounded-xl overflow-hidden border border-gray-700 bg-gray-950"
            style={{ aspectRatio: `${map.width} / ${map.height}` }}
          >
            <img
              src={map.image_url}
              alt={map.name}
              draggable="false"
              className="w-full h-full object-contain select-none pointer-events-none"
            />
            {markers.map(marker => {
              const isCollected = !!collected[marker.id]
              return (
                <div
                  key={marker.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(marker.x / map.width) * 100}%`, top: `${(marker.y / map.height) * 100}%` }}
                >
                  <button
                    onClick={() => onToggleCollected(marker.id)}
                    title={marker.title || undefined}
                    className={`block hover:scale-125 transition-transform ${isCollected ? 'opacity-40' : ''}`}
                  >
                    {marker.icon?.startsWith('/')
                      ? <img src={marker.icon} alt="" draggable="false" className="w-8 h-8 object-contain drop-shadow select-none" />
                      : <span className="text-2xl leading-none drop-shadow">{marker.icon}</span>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>,
        pipWindow.document.body
      )}
    </>
  )
}
