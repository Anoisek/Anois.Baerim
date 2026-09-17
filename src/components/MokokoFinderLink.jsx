import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

// Admin-only shortcut to the mokoko finder page, same convention as
// DogTrackerLink - kept out of the regular navbar while this is still just
// being tested (no real second map yet, see MokokoFinder.jsx).
export default function MokokoFinderLink() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()

  if (!isAdmin) return null

  return (
    <Link
      to="/mokoko-finder"
      title={t('mokokoFinder.title')}
      className="fixed top-56 right-4 z-40 flex items-center gap-1.5 bg-gray-900/95 backdrop-blur border border-gray-700 hover:border-yellow-400/50 rounded-full px-3 py-1.5 shadow-lg shadow-black/30 text-xs font-semibold text-gray-200 hover:text-yellow-400 transition-colors whitespace-nowrap"
    >
      🍀 {t('mokokoFinder.title')}
    </Link>
  )
}
