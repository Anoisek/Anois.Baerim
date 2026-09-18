import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'

export function AboutContent() {
  const { t } = useTranslation()
  const items = t('about.items', { returnObjects: true })

  return (
    <>
      <Breadcrumbs items={[
        { label: t('common.home'), to: '/' },
        { label: t('footer.about') },
      ]} />

      <h1 className="text-2xl font-bold text-gray-100 mb-6">{t('about.title')}</h1>

      <div className="flex flex-col gap-6 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-100 mb-2">{t('about.whoTitle')}</h2>
          <p>{t('about.who')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-100 mb-2">{t('about.whatTitle')}</h2>
          <p className="mb-2">{t('about.whatIntro')}</p>
          {Array.isArray(items) && (
            <ul className="list-disc list-inside flex flex-col gap-1 text-gray-400">
              {items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-100 mb-2">{t('about.dataTitle')}</h2>
          <p>{t('about.data')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-100 mb-2">{t('about.adsTitle')}</h2>
          <p>{t('about.ads')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-100 mb-2">{t('about.contactTitle')}</h2>
          <p>
            {t('about.contact')}{' '}
            <a href="mailto:anois131313@gmail.com" className="text-yellow-400 hover:underline">
              anois131313@gmail.com
            </a>
          </p>
        </section>
      </div>
    </>
  )
}

export default function About() {
  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <AboutContent />
        </div>
      </div>
    </div>
  )
}
