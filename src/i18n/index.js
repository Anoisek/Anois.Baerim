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

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem(LANG_KEY) || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', lng => {
  localStorage.setItem(LANG_KEY, lng)
  document.documentElement.lang = lng
})

export default i18n
