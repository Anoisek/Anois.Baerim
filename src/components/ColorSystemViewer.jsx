import { useEffect, useRef, useState } from 'react'
import { ColorSystemEngine } from '../lib/ColorSystemEngine'

// Persistent Three.js character preview for the Color System page. Unlike
// ModelViewer3D (which tears down and rebuilds the whole scene whenever any
// prop changes), this keeps ONE engine/scene alive for the component's
// lifetime and just tells it to switch class / equip weapon / equip armor —
// loaded classes and weapons stay cached on the engine, so flipping between
// classes or gear is instant after the first load.
export default function ColorSystemViewer({ classId, gender, weaponIcon, armorIcon, costumeIcon, hairIcon, sashIcon, caption }) {
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const engine = new ColorSystemEngine(container)
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !classId || !gender) return
    let cancelled = false
    setLoading(true)
    setError(null)
    engine.showClass(classId, gender)
      .then(() => { if (!cancelled) setLoading(false) })
      .catch((err) => { if (!cancelled) { setError(err?.message || 'Nie udało się wczytać modelu.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [classId, gender])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !classId || !weaponIcon || loading) return
    engine.equipWeapon(classId, weaponIcon).catch((err) => console.error('weapon load error', err))
  }, [classId, weaponIcon, loading])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !armorIcon || loading) return
    engine.equipArmor(armorIcon).catch((err) => console.error('armor load error', err))
  }, [armorIcon, loading])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !classId || !costumeIcon || loading) return
    engine.equipCostume(classId, costumeIcon).catch((err) => console.error('costume load error', err))
  }, [classId, costumeIcon, loading])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !classId || !hairIcon || loading) return
    engine.equipHair(classId, hairIcon).catch((err) => console.error('hair load error', err))
  }, [classId, hairIcon, loading, armorIcon, costumeIcon])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !classId || !sashIcon || loading) return
    engine.equipSash(classId, sashIcon).catch((err) => console.error('sash load error', err))
  }, [classId, sashIcon, loading, armorIcon, costumeIcon])

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-gray-700 bg-gray-950">
      <div ref={containerRef} className="absolute inset-0" />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm pointer-events-none bg-gray-950/60">
          Wczytywanie modelu…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-4 text-center pointer-events-none">
          Nie udało się wczytać modelu: {error}
        </div>
      )}
      {caption && !loading && !error && (
        <p className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-gray-400 px-3 pointer-events-none">{caption}</p>
      )}
    </div>
  )
}
