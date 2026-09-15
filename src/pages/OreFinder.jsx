import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import OreFinderCountdown from '../components/OreFinderCountdown'
import OreFinderPipButton from '../components/OreFinderPipButton'
import TurnstileWidget from '../components/TurnstileWidget'
import { db } from '../dbClient'
import { isOreAddWindowOpen } from '../utils/oreFinderWindow'

const ORE_MAP_NAMES = ['Yongan', 'Joan', 'Pyungmoo']
// Polling only - no push infra here. Kept slow-ish and paused on a hidden
// tab so this doesn't eat into the worker's shared daily request budget.
const POLL_MS = 15000
const FAVORITE_MAP_KEY = 'ore_finder_favorite_map'
const DISCORD_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1549119137903812729&permissions=183296&scope=bot%20applications.commands'

function loadFavoriteMap() {
  try {
    const stored = localStorage.getItem(FAVORITE_MAP_KEY)
    return ORE_MAP_NAMES.includes(stored) ? stored : null
  } catch {
    return null
  }
}

export default function OreFinder() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [maps, setMaps] = useState([])
  const [mapsLoading, setMapsLoading] = useState(true)
  const [favoriteMap, setFavoriteMap] = useState(loadFavoriteMap)
  const [selectedName, setSelectedName] = useState(() => loadFavoriteMap() || ORE_MAP_NAMES[0])
  const [ores, setOres] = useState([])
  const [pendingClick, setPendingClick] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmOre, setConfirmOre] = useState(null)
  const [windowOpen, setWindowOpen] = useState(() => isOreAddWindowOpen())
  const [hoverPos, setHoverPos] = useState(null)
  const mapWrapRef = useRef(null)

  useEffect(() => {
    db.from('maps').select('*').then(({ data }) => {
      setMaps((data ?? []).filter(m => ORE_MAP_NAMES.includes(m.name)))
      setMapsLoading(false)
    })
  }, [])

  function loadOres() {
    db.from('ore_finder_ores').select('*').then(({ data }) => {
      const now = Date.now()
      setOres((data ?? []).filter(o => new Date(o.expires_at).getTime() > now))
    })
  }

  // Same visibility-paused polling shape as DogTracker's fallback poll - a
  // background tab must not keep hitting the worker.
  useEffect(() => {
    loadOres()
    function poll() {
      if (document.visibilityState === 'visible') loadOres()
    }
    const intervalId = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setWindowOpen(isOreAddWindowOpen()), 1000)
    return () => clearInterval(id)
  }, [])

  const selectedMap = maps.find(m => m.name === selectedName) || null
  const oreOnSelected = ores.find(o => o.map === selectedName) || null

  function handleOreExpired(id) {
    setOres(prev => prev.filter(o => o.id !== id))
    db.from('ore_finder_ores').delete().eq('id', id)
  }

  function handleMapClick(e) {
    if (!mapWrapRef.current || !selectedMap) return
    if (!windowOpen || oreOnSelected) return
    const rect = mapWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos(null)
    setCommentDraft('')
    setTurnstileToken('')
    setPendingClick({ x, y })
  }

  function handleMapMouseMove(e) {
    if (!mapWrapRef.current) return
    const rect = mapWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setHoverPos({ x, y, clientX: e.clientX, clientY: e.clientY })
  }

  function handleMapMouseLeave() {
    setHoverPos(null)
  }

  function handleCancel() {
    setPendingClick(null)
    setCommentDraft('')
    setTurnstileToken('')
  }

  // Shared by both the in-page confirm modal and OreFinderPipButton's own
  // copy of that flow (it renders into a separate popped-out document, so
  // it can't reuse the modal below directly - only this network logic).
  async function sendOreReport(x, y, comment, turnstileTokenArg) {
    if (!selectedMap || sending) return false
    setSending(true)
    const { data, error } = await db
      .from('ore_finder_ores')
      .insert({ map: selectedMap.name, x, y, comment, turnstileToken: turnstileTokenArg })
      .select()
      .single()
    setSending(false)
    if (error) {
      alert(t('oreFinder.sendError', { message: error.message }))
      return false
    }
    setOres(prev => [...prev, data])
    return true
  }

  async function removeOre(ore) {
    setOres(prev => prev.filter(o => o.id !== ore.id))
    await db.from('ore_finder_ores').delete().eq('id', ore.id)
  }

  async function handleSend() {
    if (!pendingClick || !turnstileToken) return
    const ok = await sendOreReport(pendingClick.x, pendingClick.y, commentDraft.trim(), turnstileToken)
    if (ok) {
      setPendingClick(null)
      setCommentDraft('')
      setTurnstileToken('')
    }
  }

  async function handleStillThereNo() {
    if (!confirmOre) return
    setConfirmOre(null)
    await removeOre(confirmOre)
  }

  function toggleFavoriteMap(e, name) {
    e.stopPropagation()
    const next = favoriteMap === name ? null : name
    setFavoriteMap(next)
    try {
      if (next) localStorage.setItem(FAVORITE_MAP_KEY, next)
      else localStorage.removeItem(FAVORITE_MAP_KEY)
    } catch {
      // ignore - favorite just won't persist across visits
    }
  }

  return (
    <div className="text-white min-h-screen flex flex-col">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10 w-full">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.oreFinder') },
          ]} />
          <h1 className="text-2xl font-bold text-gray-100 mb-6">{t('systems.oreFinder')}</h1>

          {mapsLoading ? <Spinner /> : (
            <div className="flex gap-4 flex-col md:flex-row">
              <aside className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0">
                {ORE_MAP_NAMES.map(name => {
                  const active = name === selectedName
                  const hasOre = ores.some(o => o.map === name)
                  const isFavorite = favoriteMap === name
                  return (
                    <div key={name} className="relative shrink-0">
                      <button
                        onClick={() => setSelectedName(name)}
                        className={`w-full flex items-center gap-1.5 text-left pl-3 pr-8 py-2 rounded-lg text-sm font-semibold border transition-colors whitespace-nowrap md:whitespace-normal ${
                          active
                            ? 'bg-yellow-400 border-yellow-400 text-gray-950'
                            : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800 text-gray-200'
                        }`}
                      >
                        {hasOre && <span title={t('oreFinder.activeLabel')}>🪨</span>}
                        <span>{name}</span>
                      </button>
                      <button
                        onClick={e => toggleFavoriteMap(e, name)}
                        title={t('oreFinder.favoriteTooltip')}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 text-xl leading-none transition-colors ${
                          isFavorite
                            ? (active ? 'text-gray-900' : 'text-yellow-400')
                            : (active ? 'text-gray-800 hover:text-gray-950' : 'text-gray-500 hover:text-gray-300')
                        }`}
                      >
                        {isFavorite ? '★' : '☆'}
                      </button>
                    </div>
                  )
                })}
              </aside>

              <div className="flex-1 min-w-0">
                {!selectedMap ? (
                  <p className="text-gray-500 text-sm p-6">{t('systems.noMapYet')}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold text-gray-100">{selectedMap.name}</h2>
                      <OreFinderPipButton
                        map={selectedMap}
                        ore={oreOnSelected}
                        windowOpen={windowOpen}
                        isAdmin={isAdmin}
                        onSend={sendOreReport}
                        onRemove={() => oreOnSelected && removeOre(oreOnSelected)}
                        t={t}
                      />
                    </div>
                    <div
                      className="relative w-full rounded-xl border border-gray-700 bg-gray-950 overflow-y-auto overflow-x-hidden"
                      style={{ maxHeight: '70vh' }}
                    >
                      <div
                        ref={mapWrapRef}
                        onClick={handleMapClick}
                        onMouseMove={handleMapMouseMove}
                        onMouseLeave={handleMapMouseLeave}
                        className={`relative ${windowOpen && !oreOnSelected ? 'cursor-crosshair' : 'cursor-default'}`}
                        style={{ width: '100%', aspectRatio: `${selectedMap.width} / ${selectedMap.height}` }}
                      >
                        <img
                          src={selectedMap.image_url}
                          alt={selectedMap.name}
                          draggable="false"
                          className="w-full h-full object-contain select-none pointer-events-none"
                        />
                        {oreOnSelected && (
                          <button
                            onClick={e => { if (isAdmin) { e.stopPropagation(); setConfirmOre(oreOnSelected) } }}
                            title={isAdmin ? t('oreFinder.removeTooltip') : undefined}
                            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform ${isAdmin ? 'hover:scale-125' : 'cursor-default'}`}
                            style={{ left: `${oreOnSelected.x}%`, top: `${oreOnSelected.y}%` }}
                          >
                            <span className="text-3xl leading-none drop-shadow">🪨</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-xs">
                      {oreOnSelected ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-gray-400">
                            <span>{t('oreFinder.disappearsIn')}</span>
                            <OreFinderCountdown
                              expiresAt={oreOnSelected.expires_at}
                              onExpire={() => handleOreExpired(oreOnSelected.id)}
                            />
                          </div>
                          {oreOnSelected.comment && (
                            <p className="text-gray-300">💬 {oreOnSelected.comment}</p>
                          )}
                        </div>
                      ) : windowOpen ? (
                        <p className="text-yellow-400">{t('oreFinder.clickToMark')}</p>
                      ) : (
                        <p className="text-gray-500">{t('oreFinder.addWindowClosed')}</p>
                      )}
                    </div>

                    <a
                      href={DISCORD_INVITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-sm shadow-black/30 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.04.106c.36.698.772 1.362 1.225 1.994a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.673-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      {t('oreFinder.addBotButton')}
                    </a>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {hoverPos && !pendingClick && !confirmOre && (
        <div
          className="fixed z-20 pointer-events-none rounded-md border border-gray-600 bg-gray-900/90 px-2 py-1 text-[11px] font-mono text-gray-100 shadow-lg whitespace-nowrap"
          style={{ left: hoverPos.clientX + 14, top: hoverPos.clientY + 14 }}
        >
          X: {Math.round((hoverPos.x / 100) * selectedMap.width)} Y: {Math.round((hoverPos.y / 100) * selectedMap.height)}
        </div>
      )}

      {pendingClick && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCancel}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 flex flex-col items-center gap-4 shadow-xl shadow-black/50"
          >
            <p className="text-xl font-extrabold text-yellow-400 tracking-wide">{t('oreFinder.confirmTitle')}</p>
            <textarea
              value={commentDraft}
              onChange={e => setCommentDraft(e.target.value.slice(0, 200))}
              placeholder={t('oreFinder.commentPlaceholder')}
              rows={2}
              maxLength={200}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-400 resize-none"
            />
            <TurnstileWidget onToken={setTurnstileToken} />
            <div className="flex gap-3 w-full">
              <button
                onClick={handleCancel}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
              >
                {t('oreFinder.confirmCancel')}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !turnstileToken}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:hover:bg-yellow-400 text-gray-950 transition-colors"
              >
                {t('oreFinder.confirmSend')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOre && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmOre(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72 flex flex-col items-center gap-4 shadow-xl shadow-black/50"
          >
            <p className="text-lg font-bold text-gray-100 text-center">{t('oreFinder.confirmStillThereTitle')}</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleStillThereNo}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-colors"
              >
                {t('oreFinder.confirmStillThereNo')}
              </button>
              <button
                onClick={() => setConfirmOre(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
              >
                {t('oreFinder.confirmStillThereYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
