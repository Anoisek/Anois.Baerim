import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'

export default function ColorSystem() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [maintenance, setMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('settings').select('value').eq('key', 'system_colorsystem_maintenance').maybeSingle().then(({ data }) => {
      setMaintenance(data?.value === 'true')
      setLoading(false)
    })
  }, [])

  const blocked = maintenance && !isAdmin

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.colorSystem') },
          ]} />
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{t('systems.colorSystem')}</h1>
            {maintenance && isAdmin && (
              <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
                🚧 {t('common.inProgress')}
              </span>
            )}
          </div>

          {loading ? <Spinner /> : blocked ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🚧</span>
              <p className="text-sm">{t('systems.blockedMessage')}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🎨</span>
              <p className="text-sm">Nothing here yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
