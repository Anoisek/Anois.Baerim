import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import GlobalSearch from './GlobalSearch'
import LanguageSwitcher from './LanguageSwitcher'
import NightModeToggle from './NightModeToggle'
import UiScaleToggle from './UiScaleToggle'

export default function Navbar() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-6 py-3.5 flex items-center justify-between shadow-lg shadow-black/20 relative">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <img src="/small_logo.png" alt="logo" className="h-8 w-auto" />
          <span className="text-yellow-400 font-bold text-lg tracking-tight">Baerim Calculator</span>
        </Link>
        <LanguageSwitcher />
        <NightModeToggle />
        <UiScaleToggle />
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
  )
}
