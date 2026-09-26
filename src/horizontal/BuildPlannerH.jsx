import { useTranslation } from 'react-i18next'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import EquipmentBoard from '../components/EquipmentBoard'
import { PageHeader } from './ui'

export default function BuildPlannerH() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('buildCalculator.title') }]} />
        <PageHeader title={t('buildCalculator.title')} />
        <div className="max-w-2xl mx-auto">
          <EquipmentBoard horizontal />
        </div>
      </div>
    </div>
  )
}
