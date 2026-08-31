import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import pl from './locales/pl.json'
import de from './locales/de.json'
import es from './locales/es.json'
import pt from './locales/pt.json'
import ptBR from './locales/pt-BR.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import el from './locales/el.json'
import cs from './locales/cs.json'
import sk from './locales/sk.json'
import ro from './locales/ro.json'
import tr from './locales/tr.json'

const LANG_KEY = 'site_lang'

const resources = {
  en: { translation: en },
  pl: { translation: pl },
  de: { translation: de },
  es: { translation: es },
  pt: { translation: pt },
  'pt-BR': { translation: ptBR },
  fr: { translation: fr },
  it: { translation: it },
  el: { translation: el },
  cs: { translation: cs },
  sk: { translation: sk },
  ro: { translation: ro },
  tr: { translation: tr },
}

// Maps a Cloudflare edge country code (ISO 3166-1 alpha-2) to one of the
// languages above. Countries not listed here fall back to English.
const COUNTRY_LANG = {
  PL: 'pl',
  DE: 'de', AT: 'de', CH: 'de',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', GQ: 'es',
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
  PT: 'pt',
  BR: 'pt-BR',
  IT: 'it', SM: 'it', VA: 'it',
  GR: 'el', CY: 'el',
  CZ: 'cs',
  SK: 'sk',
  RO: 'ro', MD: 'ro',
  TR: 'tr',
}

const storedLang = localStorage.getItem(LANG_KEY)

i18n.use(initReactI18next).init({
  resources,
  lng: storedLang || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', lng => {
  localStorage.setItem(LANG_KEY, lng)
  document.documentElement.lang = lng
})

// First-time visitors only: guess a language from their country via
// Cloudflare's edge-injected trace endpoint, instead of leaving everyone on
// English. Anyone who already has a saved preference (including a previous
// auto-detection, or picking English themselves) keeps it untouched.
if (!storedLang) {
  fetch('/cdn-cgi/trace')
    .then(res => (res.ok ? res.text() : ''))
    .then(text => {
      const match = text.match(/^loc=([A-Z]{2})$/m)
      const lang = match && COUNTRY_LANG[match[1]]
      if (lang) i18n.changeLanguage(lang)
    })
    .catch(() => {})
}

export default i18n
