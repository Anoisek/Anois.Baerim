import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Solid background matching the horizontal pages' own bg-[#14110d] exactly —
// no transparency, so the site's old body texture never shows through behind it.
export default function FooterH() {
  const { t } = useTranslation()

  return (
    <footer className="mt-10 border-t border-white/10 bg-[#14110d] text-gray-500 text-xs">
      <div className="max-w-[90rem] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <img src="/logoanois.png" alt="Anois" className="w-6 h-6 object-contain" />
          <span>Created by <span className="font-bold">Anois</span></span>
        </div>
        <span>© {new Date().getFullYear()} BaerimTools — {t('navbar.tagline')}</span>
        <div className="flex items-center gap-4">
          <Link to="/about" className="hover:text-gray-300 transition-colors underline">{t('footer.about')}</Link>
          <Link to="/suggestions" className="hover:text-gray-300 transition-colors underline">{t('footer.suggestions')}</Link>
          <Link to="/privacy-policy" className="hover:text-gray-300 transition-colors underline">{t('footer.privacyPolicy')}</Link>
        </div>
      </div>
    </footer>
  )
}
