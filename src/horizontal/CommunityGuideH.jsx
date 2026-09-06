import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import GuideItem from '../components/GuideItem'
import { useAuth } from '../context/AuthContext'
import { db } from '../dbClient'

const CATEGORY_ORDER = ['zwoje', 'eventy', 'poziomy', 'yang', 'ekwipunek', 'techniczne', 'platnosci', 'skille']

function useHideBehindStickyNav(navRef, itemRefs, deps) {
  useEffect(() => {
    let frame = null
    function update() {
      frame = null
      const nav = navRef.current
      if (!nav) return
      const navRect = nav.getBoundingClientRect()
      for (const el of Object.values(itemRefs.current)) {
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const overlapping = rect.top < navRect.bottom && rect.bottom > navRect.top
        el.style.opacity = overlapping ? '0' : '1'
      }
    }
    function onScroll() { if (frame == null) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame != null) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export default function CommunityGuideH() {
  const { t, i18n } = useTranslation()
  const { isAdmin } = useAuth()
  const categories = t('communityGuide.categories', { returnObjects: true })
  const navRef = useRef(null)
  const itemRefs = useRef({})
  const lang = i18n.language
  const visibleCategories = lang === 'pl' ? [...CATEGORY_ORDER, 'gildia'] : CATEGORY_ORDER

  const [overrides, setOverrides] = useState({})
  const [suggestions, setSuggestions] = useState({})

  const loadLiveContent = useCallback(async () => {
    const [itemsRes, suggRes] = await Promise.all([
      db.from('guide_items').select('*').eq('lang', lang),
      isAdmin ? db.from('guide_suggestions').select('*').eq('lang', lang).order('created_at') : Promise.resolve({ data: [] }),
    ])
    const overrideMap = {}
    for (const row of itemsRes.data || []) overrideMap[`${row.category_id}:${row.item_index}`] = { question: row.question, answer: row.answer }
    setOverrides(overrideMap)
    const suggMap = {}
    for (const row of suggRes.data || []) {
      const key = `${row.category_id}:${row.item_index}`
      if (!suggMap[key]) suggMap[key] = []
      suggMap[key].push(row)
    }
    setSuggestions(suggMap)
  }, [lang, isAdmin])

  useEffect(() => { loadLiveContent() }, [loadLiveContent])
  useHideBehindStickyNav(navRef, itemRefs, [categories])

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('communityGuide.breadcrumb') }]} />

        <h1 className="text-xl font-bold text-gray-100 mb-2 mt-4">{t('communityGuide.title')}</h1>
        <p className="text-sm text-gray-400 mb-6">{t('communityGuide.subtitle')}</p>

        <div className="flex items-start gap-3 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 mb-8">
          <span className="text-lg leading-none">🤖</span>
          <p className="text-xs text-yellow-200/90 leading-relaxed">
            <strong className="text-yellow-300">{t('communityGuide.disclaimerLabel')}</strong> {t('communityGuide.disclaimerBody')}
          </p>
        </div>

        <nav ref={navRef} className="sticky top-16 z-30 flex flex-wrap gap-2 mb-10 py-4 bg-transparent">
          {visibleCategories.map(id => (
            <a key={id} href={`#${id}`}
              className="text-xs font-semibold text-gray-200 hover:text-yellow-400 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-yellow-400/50 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap shadow-sm shadow-black/30">
              {categories[id].title}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-12">
          {visibleCategories.map(id => (
            <section key={id} id={id} className="scroll-mt-48">
              <h2 ref={el => { itemRefs.current[`${id}-title`] = el }} className="text-lg font-bold text-yellow-400 mb-4 transition-opacity duration-150">
                {categories[id].title}
              </h2>
              <div className="flex flex-col gap-3">
                {categories[id].items.map((item, i) => {
                  const refKey = `${id}-${i}`
                  const overrideKey = `${id}:${i}`
                  const override = overrides[overrideKey]
                  return (
                    <GuideItem
                      key={i}
                      categoryId={id}
                      index={i}
                      question={override?.question ?? item.q}
                      answer={override?.answer ?? item.a}
                      disputed={!!item.disputed}
                      isAdmin={isAdmin}
                      lang={lang}
                      suggestions={suggestions[overrideKey] || []}
                      cardRef={el => { itemRefs.current[refKey] = el }}
                      onChanged={loadLiveContent}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="text-xs text-gray-600 text-center mt-12 pt-6 border-t border-white/10">{t('communityGuide.footerNote')}</p>
      </div>
    </div>
  )
}
