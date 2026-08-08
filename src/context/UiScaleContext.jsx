import { createContext, useContext, useEffect, useState } from 'react'

const UiScaleContext = createContext(null)
const SCALE_KEY = 'ui_scale'
const DEFAULT_SCALE = 100
const MIN_SCALE = 70
const MAX_SCALE = 130

export function UiScaleProvider({ children }) {
  const [scale, setScaleState] = useState(() => {
    const stored = Number(localStorage.getItem(SCALE_KEY))
    return stored >= MIN_SCALE && stored <= MAX_SCALE ? stored : DEFAULT_SCALE
  })

  function setScale(value) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
    setScaleState(clamped)
    localStorage.setItem(SCALE_KEY, String(clamped))
  }

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale}%`
  }, [scale])

  return (
    <UiScaleContext.Provider value={{ scale, setScale, MIN_SCALE, MAX_SCALE, DEFAULT_SCALE }}>
      {children}
    </UiScaleContext.Provider>
  )
}

export function useUiScale() {
  return useContext(UiScaleContext)
}
