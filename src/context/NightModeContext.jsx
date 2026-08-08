import { createContext, useContext, useEffect, useState } from 'react'

const NightModeContext = createContext(null)
const NIGHT_KEY = 'night_mode'

export function NightModeProvider({ children }) {
  const [night, setNightState] = useState(() => localStorage.getItem(NIGHT_KEY) === 'true')

  function toggleNight() {
    setNightState(prev => {
      const next = !prev
      localStorage.setItem(NIGHT_KEY, String(next))
      return next
    })
  }

  useEffect(() => {
    document.documentElement.classList.toggle('night-mode', night)
  }, [night])

  return (
    <NightModeContext.Provider value={{ night, toggleNight }}>
      {children}
    </NightModeContext.Provider>
  )
}

export function useNightMode() {
  return useContext(NightModeContext)
}
