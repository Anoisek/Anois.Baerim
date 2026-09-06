import { createContext, useContext, useEffect, useState } from 'react'

const LayoutStyleContext = createContext(null)
const LAYOUT_KEY = 'layout_style_horizontal'

export function LayoutStyleProvider({ children }) {
  const [horizontal, setHorizontalState] = useState(() => localStorage.getItem(LAYOUT_KEY) === 'true')

  function toggleLayout() {
    setHorizontalState(prev => {
      const next = !prev
      localStorage.setItem(LAYOUT_KEY, String(next))
      return next
    })
  }

  useEffect(() => {
    document.documentElement.classList.toggle('layout-horizontal', horizontal)
  }, [horizontal])

  return (
    <LayoutStyleContext.Provider value={{ horizontal, toggleLayout }}>
      {children}
    </LayoutStyleContext.Provider>
  )
}

export function useLayoutStyle() {
  return useContext(LayoutStyleContext)
}
