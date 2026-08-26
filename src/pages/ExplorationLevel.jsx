import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import EditExplorationLevelModal from '../components/EditExplorationLevelModal'

export default function ExplorationLevel() {
  const { level } = useParams()
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [row, setRow] = useState(null)
  const [maxLevel, setMaxLevel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      db.from('exploration_levels').select('*').eq('level', Number(level)).maybeSingle(),
      db.from('exploration_levels').select('level').order('level', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([rowRes, maxRes]) => {
      setRow(rowRes.data)
      setMaxLevel(maxRes.data?.level ?? null)
      setLoading(false)
    })
  }, [level])

  const levelNum = Number(level)
  const prevLevel = levelNum > 1 ? levelNum - 1 : null
  const nextLevel = maxLevel && levelNum < maxLevel ? levelNum + 1 : null

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          {loading ? <Spinner /> : !row ? (
            <>
              <Breadcrumbs items={[
                { label: t('common.home'), to: '/' },
                { label: t('systems.title'), to: '/systems' },
                { label: t('systems.exploration'), to: '/systems/exploration' },
              ]} />
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">{t('systems.levelNotFound')}</p>
              </div>
            </>
          ) : (
            <>
              <Breadcrumbs items={[
                { label: t('common.home'), to: '/' },
                { label: t('systems.title'), to: '/systems' },
                { label: t('systems.exploration'), to: '/systems/exploration' },
                { label: row.title || t('systems.levelTitlePlaceholder', { level: row.level }) },
              ]} />

              <div className="flex items-center justify-between gap-3 mb-4">
                {prevLevel ? (
                  <Link to={`/systems/exploration/${prevLevel}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400 transition-colors">
                    <span className="text-base leading-none">‹</span>
                    {t('systems.levelShort', { level: prevLevel })}
                  </Link>
                ) : <span />}
                {nextLevel && (
                  <Link to={`/systems/exploration/${nextLevel}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('systems.levelShort', { level: nextLevel })}
                    <span className="text-base leading-none">›</span>
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3 mb-6 p-5 bg-gray-900 border border-gray-700 rounded-2xl flex-wrap">
                <img src="/exploration_flag.png" alt="" className="w-14 h-14 object-contain shrink-0" />
                <h1 className="text-2xl font-bold text-yellow-400 flex-1">
                  {row.title || t('systems.levelTitlePlaceholder', { level: row.level })}
                </h1>
                {isAdmin && (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    ✏️ {t('common.edit')}
                  </button>
                )}
              </div>

              {row.image_urls?.length > 0 && (
                <div className="flex gap-3 overflow-x-auto mb-4 pb-1">
                  {row.image_urls.map(url => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-40 w-auto object-contain rounded-xl border border-gray-700 shrink-0 bg-gray-900"
                    />
                  ))}
                </div>
              )}

              {row.description ? (
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-gray-900 border border-gray-700 rounded-2xl p-5">
                  {row.description}
                </p>
              ) : (
                <div className="flex flex-col items-center py-16 text-gray-500 gap-3">
                  <span className="text-4xl">📝</span>
                  <p className="text-sm">{t('systems.noDescriptionYet')}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editing && row && (
        <EditExplorationLevelModal
          level={row}
          onClose={() => setEditing(false)}
          onSaved={updated => setRow(updated)}
        />
      )}
    </div>
  )
}
