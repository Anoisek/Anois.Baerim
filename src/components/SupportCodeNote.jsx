import { useTranslation } from 'react-i18next'

// Same referral link as PromoBanner.
export default function SupportCodeNote() {
  const { t } = useTranslation()
  return (
    <a
      href="https://baerim.eu/a/anois"
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-center gap-2 flex-wrap mb-6 px-4 py-2.5 rounded-xl border border-yellow-500/25 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50 text-sm text-gray-300 text-center transition-colors"
    >
      <span>💛 {t('maps.supportCodeBefore')}</span>
      <span className="font-mono font-bold tracking-wider text-yellow-400 px-2 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/30 group-hover:bg-yellow-500/20 transition-colors">
        ANOIS
      </span>
      <span>{t('maps.supportCodeAfter')} ↗</span>
    </a>
  )
}
