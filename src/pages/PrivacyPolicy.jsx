import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'

export default function PrivacyPolicy() {
  const { t } = useTranslation()

  const sections = ['intro', 'localData', 'serverData', 'hostingLogs', 'rights', 'changes']
  const localDataItems = t('privacyPolicy.localData.items', { returnObjects: true })

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('footer.privacyPolicy') },
          ]} />

          <h1 className="text-2xl font-bold text-gray-100 mb-1">{t('footer.privacyPolicy')}</h1>
          <p className="text-xs text-gray-500 mb-8">{t('privacyPolicy.lastUpdated')}</p>

          <div className="flex flex-col gap-6 text-sm text-gray-300 leading-relaxed">
            {sections.map(key => (
              <section key={key}>
                <h2 className="text-lg font-semibold text-gray-100 mb-2">{t(`privacyPolicy.${key}.title`)}</h2>
                <p className={key === 'localData' ? 'mb-2' : ''}>
                  {t(`privacyPolicy.${key}.${key === 'localData' ? 'intro' : 'body'}`)}
                </p>
                {key === 'localData' && Array.isArray(localDataItems) && (
                  <ul className="list-disc list-inside flex flex-col gap-1 text-gray-400">
                    {localDataItems.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                )}
              </section>
            ))}

            <section>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">{t('privacyPolicy.contact.title')}</h2>
              <p>
                {t('privacyPolicy.contact.body')}{' '}
                <a href="mailto:anois131313@gmail.com" className="text-yellow-400 hover:underline">
                  anois131313@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
