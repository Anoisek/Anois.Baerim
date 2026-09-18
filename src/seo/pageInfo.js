// Single source of truth for per-page SEO: which route uses which i18n key.
// The texts live in locales/*.json under `pageInfo.<key>` ({ title, description, body }).
// Used at runtime (document title, meta description, collapsed info block) and by the
// build-time prerender plugin (vite.config.js) that emits a static HTML file per route.
//
// `details: false` = page is itself text content, so it gets a title/description
// but no extra collapsed "About this tool" block.
export const PAGE_INFO = [
  { key: 'home', path: '/', details: true },
  { key: 'materials', path: '/materials', details: true },
  { key: 'systems', path: '/systems', details: true },
  { key: 'bonuses', path: '/systems/bonuses', details: true },
  { key: 'alchemy', path: '/systems/alchemy', details: true },
  { key: 'exploration', path: '/systems/exploration', details: true },
  { key: 'interactiveMap', path: '/systems/interactive-map', details: true },
  { key: 'metinCalculator', path: '/systems/metin-calculator', details: true },
  { key: 'colorSystem', path: '/systems/color-system', details: true },
  { key: 'oreFinder', path: '/systems/ore-finder', details: true },
  { key: 'mokokoFinder', path: '/mokoko-finder', details: true },
  { key: 'buildCalculator', path: '/buildcalculator', details: true },
  { key: 'compendium', path: '/aiguide', details: false },
  { key: 'about', path: '/about', details: false },
  { key: 'contact', path: '/suggestions', details: false },
  { key: 'privacyPolicy', path: '/privacy-policy', details: false },
]

export const SITE_URL = 'https://baerimtools.com'

export function findPageInfo(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PAGE_INFO.find(p => p.path === clean) ?? null
}
