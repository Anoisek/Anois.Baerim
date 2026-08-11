import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'

export default function Exploration() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [mapUrl, setMapUrl] = useState(null)
  const [maintenance, setMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('settings').select('value').eq('key', 'exploration_map_url').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'system_exploration_maintenance').maybeSingle(),
    ]).then(([mapRes, maintRes]) => {
      setMapUrl(mapRes.data?.value ?? null)
      setMaintenance(maintRes.data?.value === 'true')
      setLoading(false)
    })
  }, [])

  const blocked = maintenance && !isAdmin

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.exploration') },
          ]} />
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{t('systems.exploration')}</h1>
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
          ) : mapUrl ? (
            <img src={mapUrl} alt={t('systems.exploration')} className="w-full h-auto rounded-xl border border-gray-700" />
          ) : (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🗺️</span>
              <p className="text-sm">{t('systems.noMapYet')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
