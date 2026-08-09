import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="mt-10 border-t border-gray-800 bg-gray-900/80 backdrop-blur text-gray-500 text-xs">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© {new Date().getFullYear()} Baerim Calculator — {t('navbar.tagline')}</span>
        <div className="flex items-center gap-4">
          <Link to="/suggestions" className="hover:text-gray-300 transition-colors underline">
            {t('footer.suggestions')}
          </Link>
          <Link to="/privacy-policy" className="hover:text-gray-300 transition-colors underline">
            {t('footer.privacyPolicy')}
          </Link>
        </div>
      </div>
    </footer>
  )
}
