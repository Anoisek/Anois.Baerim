import { useEffect, useRef, useState, useCallback } from 'react'

function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
  let r, g, b
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360
  return [h, max === 0 ? 0 : d / max, max]
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}
function hexToRgb(hex) {
  hex = hex.replace('#', '')
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const num = parseInt(hex, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}
function hueToColor(h) { return 'rgb(' + hsvToRgb(h, 1, 1).join(',') + ')' }

const SIZE = 220

export default function ColorPicker({ value, onChange }) {
  const svRef = useRef(null)
  const hueRef = useRef(null)
  const [hsv, setHsv] = useState(() => { const [r, g, b] = hexToRgb(value); return rgbToHsv(r, g, b) })

  useEffect(() => {
    const [r, g, b] = hexToRgb(value)
    setHsv(rgbToHsv(r, g, b))
  }, [value])

  const drawHue = useCallback(() => {
    const ctx = hueRef.current?.getContext('2d')
    if (!ctx) return
    const grad = ctx.createLinearGradient(0, 0, 0, SIZE)
    ;[0, 60, 120, 180, 240, 300, 360].forEach((h) => grad.addColorStop(h / 360, hueToColor(h)))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 22, SIZE)
  }, [])

  const drawSv = useCallback((hue) => {
    const ctx = svRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = hueToColor(hue)
    ctx.fillRect(0, 0, SIZE, SIZE)
    const whiteGrad = ctx.createLinearGradient(0, 0, SIZE, 0)
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)')
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = whiteGrad
    ctx.fillRect(0, 0, SIZE, SIZE)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, SIZE)
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)')
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = blackGrad
    ctx.fillRect(0, 0, SIZE, SIZE)
  }, [])

  const hue = hsv[0]
  useEffect(() => { drawHue() }, [drawHue])
  useEffect(() => { drawSv(hue) }, [drawSv, hue])

  function commit(nextHsv) {
    setHsv(nextHsv)
    const [r, g, b] = hsvToRgb(...nextHsv)
    onChange(rgbToHex(r, g, b))
  }

  function pointerToSv(e) {
    const rect = svRef.current.getBoundingClientRect()
    const x = Math.min(Math.max(e.clientX - rect.left, 0), SIZE)
    const y = Math.min(Math.max(e.clientY - rect.top, 0), SIZE)
    commit([hsv[0], x / SIZE, 1 - y / SIZE])
  }
  function pointerToHue(e) {
    const rect = hueRef.current.getBoundingClientRect()
    const y = Math.min(Math.max(e.clientY - rect.top, 0), SIZE)
    commit([(y / SIZE) * 360, hsv[1], hsv[2]])
  }

  function dragify(handler) {
    return {
      onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); handler(e) },
      onPointerMove: (e) => { if (e.buttons === 1) handler(e) },
    }
  }

  const [r, g, b] = hsvToRgb(...hsv)
  const cursorLeft = hsv[1] * SIZE
  const cursorTop = (1 - hsv[2]) * SIZE
  const hueTop = (hsv[0] / 360) * SIZE

  return (
    <div className="flex gap-4 items-start">
      <div className="relative rounded-lg overflow-hidden cursor-crosshair" style={{ width: SIZE, height: SIZE }}>
        <canvas ref={svRef} width={SIZE} height={SIZE} {...dragify(pointerToSv)} />
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: cursorLeft, top: cursorTop }}
        />
      </div>
      <div className="relative rounded-lg overflow-hidden cursor-ns-resize" style={{ width: 22, height: SIZE }}>
        <canvas ref={hueRef} width={22} height={SIZE} {...dragify(pointerToHue)} />
        <div
          className="absolute left-0 right-0 h-1 border border-white pointer-events-none -translate-y-1/2"
          style={{ top: hueTop }}
        />
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <label className="text-xs text-gray-400">HEX</label>
        <input
          type="text"
          value={rgbToHex(r, g, b)}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (!/^#?[0-9a-fA-F]{6}$/.test(v)) return
            const hex = v[0] === '#' ? v : '#' + v
            const [rr, gg, bb] = hexToRgb(hex)
            commit(rgbToHsv(rr, gg, bb))
          }}
          className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
        />
        <p className="text-xs text-gray-500">rgb({r}, {g}, {b})</p>
      </div>
    </div>
  )
}
