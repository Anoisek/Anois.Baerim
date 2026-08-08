import { createContext, useContext, useState } from 'react'

const NightModeContext = createContext(null)
const DIM_KEY = 'night_mode_dim'

export function NightModeProvider({ children }) {
  const [dim, setDimState] = useState(() => Number(localStorage.getItem(DIM_KEY) ?? 0))

  function setDim(value) {
    setDimState(value)
    localStorage.setItem(DIM_KEY, String(value))
  }

  return (
    <NightModeContext.Provider value={{ dim, setDim }}>
      {children}
    </NightModeContext.Provider>
  )
}

export function useNightMode() {
  return useContext(NightModeContext)
}
