import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// React Router doesn't reset scroll position on client-side navigation —
// without this, clicking a link while scrolled down on the previous page
// lands you at the same scroll offset on the new page instead of the top.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
