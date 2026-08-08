import { createContext, useContext, useEffect, useState } from 'react'

const NightModeContext = createContext(null)
const DIM_KEY = 'night_mode_dim'

export function NightModeProvider({ children }) {
  const [dim, setDimState] = useState(() => Number(localStorage.getItem(DIM_KEY) ?? 0))

  function setDim(value) {
    setDimState(value)
    localStorage.setItem(DIM_KEY, String(value))
  }

  useEffect(() => {
    if (dim <= 0) {
      document.documentElement.style.filter = ''
      return
    }
    const brightness = 1 - (dim / 100) * 0.7
    const contrast = 1 + (dim / 100) * 0.15
    document.documentElement.style.filter = `brightness(${brightness}) contrast(${contrast})`
  }, [dim])

  return (
    <NightModeContext.Provider value={{ dim, setDim }}>
      {children}
    </NightModeContext.Provider>
  )
}

export function useNightMode() {
  return useContext(NightModeContext)
}
