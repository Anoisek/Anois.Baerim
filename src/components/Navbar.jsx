import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import GlobalSearch from './GlobalSearch'
import LanguageSwitcher from './LanguageSwitcher'
import NightModeToggle from './NightModeToggle'
import UiScaleToggle from './UiScaleToggle'
import DonateButton from './DonateButton'
import PromoBanner from './PromoBanner'

// Every page wraps its content in `max-w-Nxl mx-auto px-6 ...`, but N varies
// per page (2xl/3xl/4xl/5xl) — that div is the next DOM sibling after this
// component's own output. Measuring its real width (minus its own px-6
// padding, 24px each side) instead of hardcoding a max-w-* class here keeps
// the banner matching whatever "square" each page actually uses.
function useContentWidth() {
  const [width, setWidth] = useState(null)

  useEffect(() => {
    const nav = document.querySelector('nav')
    let el = nav?.nextElementSibling
    while (el?.hasAttribute('data-navbar-banner')) el = el.nextElementSibling
    if (!el) return

    const update = () => setWidth(el.getBoundingClientRect().width - 48)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return width
}

export default function Navbar() {
  const { isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const contentWidth = useContentWidth()

  function handleLogout() {
    logout()
    navigate('/')
  }

  const isHome = location.pathname === '/'

  return (
    <>
      <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-6 py-3.5 flex items-center justify-between shadow-lg shadow-black/20 relative">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/small_logo.png" alt="logo" className="h-8 w-auto" />
            <span className="text-yellow-400 font-bold text-lg tracking-tight">BaerimTools</span>
          </Link>
          <LanguageSwitcher />
          <NightModeToggle />
          <UiScaleToggle />
          <DonateButton />
        </div>
        <div className="flex items-center gap-4">
          <GlobalSearch />
          {isAdmin ? (
            <>
              <span className="text-xs bg-yellow-400 text-gray-950 font-bold px-2.5 py-1 rounded-full">{t('navbar.admin')}</span>
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white transition-colors">
                {t('navbar.logOut')}
              </button>
            </>
          ) : (
            <Link to="/login" className="text-sm text-gray-500 hover:text-white transition-colors">
              {t('navbar.adminLogin')}
            </Link>
          )}
        </div>
      </nav>
      {/* Home renders its own PromoBanner below the chapters box instead. */}
      {!isHome && (
        <div data-navbar-banner className="max-w-5xl mx-auto pt-6" style={contentWidth ? { width: contentWidth, maxWidth: contentWidth } : undefined}>
          <PromoBanner />
        </div>
      )}
    </>
  )
}
