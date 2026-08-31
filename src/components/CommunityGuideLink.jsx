import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

// Admin-only shortcut to the community guide. Anyone with the direct
// /kompendium link can still open the page — this just keeps it out of
// the regular navbar for everyone else.
export default function CommunityGuideLink() {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()

  if (!isAdmin) return null

  return (
    <Link
      to="/kompendium"
      title={t('communityGuide.title')}
      className="fixed top-32 right-4 z-40 flex items-center gap-1.5 bg-gray-900/95 backdrop-blur border border-gray-700 hover:border-yellow-400/50 rounded-full px-3 py-1.5 shadow-lg shadow-black/30 text-xs font-semibold text-gray-200 hover:text-yellow-400 transition-colors whitespace-nowrap"
    >
      📜 {t('communityGuide.navLink')}
    </Link>
  )
}
