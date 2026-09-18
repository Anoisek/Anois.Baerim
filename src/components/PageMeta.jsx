import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { findPageInfo, SITE_URL } from '../seo/pageInfo'

function setMeta(selector, create, value) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(el.tagName === 'LINK' ? 'href' : 'content', value)
}

// Keeps <title>, meta description and canonical in sync with the current route.
// Routes without an entry (item/material detail pages etc.) fall back to the site default.
export default function PageMeta() {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  useEffect(() => {
    const page = findPageInfo(pathname)
    const siteTitle = t('pageInfo.siteTitle')
    const title = page && page.key !== 'home' ? `${t(`pageInfo.${page.key}.title`)} – BaerimTools` : siteTitle
    const description = t(`pageInfo.${page ? page.key : 'home'}.description`)

    document.title = title
    setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), description)
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), SITE_URL + (page ? page.path : pathname))
  }, [pathname, t])

  return null
}
