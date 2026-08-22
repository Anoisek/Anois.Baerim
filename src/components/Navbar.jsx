import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import GlobalSearch from './GlobalSearch'
import LanguageSwitcher from './LanguageSwitcher'
import NightModeToggle from './NightModeToggle'
import UiScaleToggle from './UiScaleToggle'
import DonateButton from './DonateButton'
import PromoBanner from './PromoBanner'

export default function Navbar() {
  const { isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

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
            <span className="text-yellow-400 font-bold text-lg tracking-tight">Baerim Calculator</span>
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
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <PromoBanner />
        </div>
      )}
    </>
  )
}
