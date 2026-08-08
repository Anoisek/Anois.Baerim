import { useNightMode } from '../context/NightModeContext'

export default function DimOverlay() {
  const { dim } = useNightMode()
  if (dim <= 0) return null

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ backgroundColor: `rgba(0,0,0,${(dim / 100) * 0.85})` }}
    />
  )
}
