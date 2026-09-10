import { useTranslation } from 'react-i18next'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'

export default function PrivacyPolicyH() {
  const { t } = useTranslation()
  const sections = ['intro', 'localData', 'serverData', 'ads', 'hostingLogs', 'rights', 'changes']
  const localDataItems = t('privacyPolicy.localData.items', { returnObjects: true })

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('footer.privacyPolicy') }]} />
        <h1 className="text-xl font-bold text-gray-100 mb-1 mt-4">{t('footer.privacyPolicy')}</h1>
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
              <a href="mailto:anois131313@gmail.com" className="text-yellow-400 hover:underline">anois131313@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
