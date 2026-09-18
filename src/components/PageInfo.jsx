import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { findPageInfo } from '../seo/pageInfo'

// Short, collapsed-by-default explanation of the current tool. Rendered for everyone
// (never bot-only) — the same text is also what the prerendered HTML contains.
export default function PageInfo() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const page = findPageInfo(pathname)
  if (!page?.details) return null

  return (
    <details key={page.key} className="max-w-5xl w-full mx-auto mt-8 px-6 text-xs text-gray-500 group">
      <summary className="cursor-pointer select-none hover:text-gray-300 transition-colors">
        {t('pageInfo.summary')}: {t(`pageInfo.${page.key}.title`)}
      </summary>
      <p className="mt-2 leading-relaxed text-gray-400 max-w-3xl">{t(`pageInfo.${page.key}.body`)}</p>
    </details>
  )
}
