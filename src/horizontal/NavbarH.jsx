import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { db } from '../dbClient'
import { PVP_CATEGORY_ID } from '../utils/itemName'
import { slugify } from '../utils/slug'
import GlobalSearch from '../components/GlobalSearch'
import LanguageSwitcher from '../components/LanguageSwitcher'
import NightModeToggle from '../components/NightModeToggle'
import UiScaleToggle from '../components/UiScaleToggle'
import LayoutStyleToggle from '../components/LayoutStyleToggle'
import DonateButton from '../components/DonateButton'

const NAV_LINKS = [
  { to: '/materials', labelKey: 'home.materials' },
  { to: '/systems', labelKey: 'home.systems' },
  { to: '/buildcalculator', labelKey: 'home.buildCalculator' },
]

// The chapters (categories) list on Home, but reachable from the nav bar too
// instead of only from the homepage — sorted the same way, except PVP always
// sinks to the bottom of the list regardless of its own sort_order.
function ChaptersMenu() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    db.from('categories').select('id, name, sort_order').order('sort_order').then(({ data }) => {
      setCategories(data ?? [])
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (categories.length === 0) return null

  const sorted = [...categories].sort((a, b) => {
    if (a.id === PVP_CATEGORY_ID) return 1
    if (b.id === PVP_CATEGORY_ID) return -1
    return a.sort_order - b.sort_order
  })

  return (
    <div className="relative h-16 shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`relative px-3 h-16 flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${
          open ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-200'
        } after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ${
          open ? 'after:bg-yellow-400' : 'after:bg-transparent'
        }`}
      >
        {t('home.chapters')}
        <span className="text-[9px] leading-none">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 bg-[#1c1712] border border-white/10 rounded-lg shadow-xl min-w-48 max-h-[70vh] overflow-y-auto py-1">
          {sorted.map(cat => (
            <Link
              key={cat.id}
              to={`/chapter/${slugify(cat.name)}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/5 hover:text-yellow-400 transition-colors whitespace-nowrap"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// The vertical site's Navbar has no persistent section links — you navigate
// back to Home to switch sections. This bar is a genuinely different piece
// of chrome: a real top nav with the sections always one click away, plus a
// thin yellow rule under the active link instead of the old bordered pill.
export default function NavbarH() {
  const { isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-[#14110d]/95 backdrop-blur border-b border-yellow-900/30">
      <div className="max-w-[90rem] mx-auto px-6 h-16 flex items-center gap-8">
        <NavLink to="/" className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity">
          <img src="/small_logo.png" alt="logo" className="h-8 w-auto" />
          <span className="text-yellow-400 font-bold text-lg tracking-tight hidden sm:inline">BaerimTools</span>
        </NavLink>

        <div className="flex items-center gap-1 flex-1 min-w-0">
          <nav className="flex items-center gap-1 min-w-0 overflow-x-auto">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `relative px-3 h-16 flex items-center text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-200'
                  } after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ${
                    isActive ? 'after:bg-yellow-400' : 'after:bg-transparent'
                  }`
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
          </nav>

          {/* Right next to the nav links, but outside the scrollable <nav> on
              purpose — that container's overflow-x-auto also clips (and can
              visually enlarge) anything absolutely positioned inside it, which
              made the dropdown panel misbehave. */}
          <ChaptersMenu />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <GlobalSearch />
          {/* LayoutStyleToggle stays outside the hidden-below-md cluster — it's the
              only way back to the vertical site, so it can't disappear on a narrow window. */}
          <LayoutStyleToggle />
          <div className="hidden md:flex items-center gap-1 pl-2 border-l border-white/10">
            <LanguageSwitcher />
            <NightModeToggle />
            <UiScaleToggle />
          </div>
          <DonateButton />
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] bg-yellow-400 text-gray-950 font-bold px-2 py-1 rounded-full">{t('navbar.admin')}</span>
              <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white transition-colors">
                {t('navbar.logOut')}
              </button>
            </div>
          ) : (
            <NavLink to="/login" className="text-xs text-gray-500 hover:text-white transition-colors whitespace-nowrap">
              {t('navbar.adminLogin')}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  )
}
