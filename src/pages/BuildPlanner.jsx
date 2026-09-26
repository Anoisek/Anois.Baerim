import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import EquipmentBoard from '../components/EquipmentBoard'

export default function BuildPlanner() {
  const { t } = useTranslation()

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6">
          <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('buildCalculator.title') }]} />
          <h1 className="text-2xl font-bold text-gray-100 mb-6">{t('buildCalculator.title')}</h1>
          <EquipmentBoard />
        </div>
      </div>
    </div>
  )
}
