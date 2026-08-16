import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import ModelViewer3D from '../components/ModelViewer3D'

// Module-level (not recreated per render) so ModelViewer3D's effect doesn't
// reload the model on every ColorSystem re-render.
// Rotation is solved via quaternion math (bone world orientation inverted,
// composed with "point blade straight down" plus a 90° roll around that
// down-axis so the blade faces the right way), not hand-guessed — the hand
// bone's rest orientation isn't axis-aligned, so a simple Euler guess only
// looks right from some camera angles and swings out from others.
const FMS_WEAPON = {
  url: '/models/fms/scene.gltf',
  boneMatch: 'R_Hand',
  scale: 100,
  rotation: [176.48, -0.84, -111.92],
}

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
      <div className="max-w-4xl mx-auto px-6 py-10">
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
            <div className="flex flex-col gap-3">
              <div className="h-[520px]">
                <ModelViewer3D modelUrl="/models/sura_male/scene.gltf" useOwnMaterials weapon={FMS_WEAPON} />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Sura (male novice) + Full Moon Sword — placeholder reference model while the female mesh and other
                classes are still being sourced. Drag to rotate, scroll to zoom.
              </p>
              <p className="text-[10px] text-gray-600 text-center">
                Models: "Metin2 - Sura Novice Idle loop" and "Metin2 - Full Moon Sword" by{' '}
                <a href="https://sketchfab.com/ytachi1000" target="_blank" rel="noreferrer" className="underline hover:text-gray-400">
                  Ytachi1000
                </a>{' '}
                on Sketchfab, licensed{' '}
                <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline hover:text-gray-400">
                  CC-BY-4.0
                </a>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
