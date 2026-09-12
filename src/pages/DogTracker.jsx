import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { db } from '../dbClient'

const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL
const METINS = ['Metin of Gloom', 'Metin of Ember', 'Metin of Wrath', 'Metin of Calamity']
const TIERS = ['I', 'II', 'III']
const TABS = METINS.flatMap(metin => TIERS.map(tier => ({ metin, tier })))
const CHANNELS = [1, 2, 3, 4, 5, 6]
const CIRCLES_KEY = 'dogtracker_circles'
const DOG_TTL_MS = 5 * 60 * 1000

function tabKey(tab) {
  return `${tab.metin}__${tab.tier}`
}

function sameTab(a, b) {
  return !!a && !!b && a.metin === b.metin && a.tier === b.tier
}

function isExpired(dog) {
  return Date.now() - new Date(dog.created_at).getTime() > DOG_TTL_MS
}

export default function DogTracker() {
  const { isAdmin, isDogtrackerUser } = useAuth()
  const [map, setMap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(TABS[0])
  const [circles, setCircles] = useState({})
  const [editingTab, setEditingTab] = useState(null)
  const [dogs, setDogs] = useState([])
  const [pendingClick, setPendingClick] = useState(null)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [sending, setSending] = useState(false)
  const [confirmDog, setConfirmDog] = useState(null)
  const [geo, setGeo] = useState('checking')
  const mapWrapRef = useRef(null)

  useEffect(() => {
    fetch(`${WORKER_URL}/geo`)
      .then(r => r.json())
      .then(data => setGeo(data.country === 'PL' ? 'allowed' : 'blocked'))
      .catch(() => setGeo('error'))
  }, [])

  const allowed = geo === 'allowed' || isAdmin || isDogtrackerUser

  useEffect(() => {
    if (!allowed) return
    db.from('maps').select('*').eq('name', 'Dragon Flame Cape').maybeSingle().then(({ data }) => {
      setMap(data)
      setLoading(false)
    })
    db.from('settings').select('value').eq('key', CIRCLES_KEY).maybeSingle().then(({ data }) => {
      if (!data?.value) return
      try {
        setCircles(JSON.parse(data.value))
      } catch {
        // ignore malformed stored value
      }
    })
  }, [allowed])

  useEffect(() => {
    if (!allowed) return
    db.from('dogtracker_dogs').select('*').eq('metin', selected.metin).eq('tier', selected.tier).then(({ data }) => {
      setDogs((data ?? []).filter(dog => !isExpired(dog)))
    })
  }, [allowed, selected.metin, selected.tier])

  // Dogs disappear on their own 5 minutes after being reported. Checked
  // periodically rather than with one timer per dog, since dogs come and go.
  useEffect(() => {
    if (!allowed) return
    const id = setInterval(() => {
      setDogs(prev => {
        const alive = prev.filter(dog => !isExpired(dog))
        for (const dog of prev) {
          if (isExpired(dog)) db.from('dogtracker_dogs').delete().eq('id', dog.id)
        }
        return alive.length === prev.length ? prev : alive
      })
    }, 15000)
    return () => clearInterval(id)
  }, [allowed])

  function toggleEdit(tab) {
    setSelected(tab)
    setEditingTab(prev => (sameTab(prev, tab) ? null : tab))
  }

  async function handleMapClick(e) {
    if (!mapWrapRef.current) return
    const rect = mapWrapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (editingTab) {
      const next = { ...circles, [tabKey(editingTab)]: { x, y } }
      setCircles(next)
      setEditingTab(null)
      await db.from('settings').upsert({ key: CIRCLES_KEY, value: JSON.stringify(next) })
      return
    }

    setSelectedChannel(null)
    setPendingClick({ x, y })
  }

  function handleCancelDog() {
    setPendingClick(null)
    setSelectedChannel(null)
  }

  async function handleSendDog() {
    if (!pendingClick || !selectedChannel || sending) return
    setSending(true)
    const { data, error } = await db
      .from('dogtracker_dogs')
      .insert({ metin: selected.metin, tier: selected.tier, x: pendingClick.x, y: pendingClick.y, channel: selectedChannel })
      .select()
      .single()
    setSending(false)
    if (error) {
      alert('Nie udało się zgłosić: ' + error.message)
      return
    }
    setDogs(prev => [...prev, data])
    setPendingClick(null)
    setSelectedChannel(null)
  }

  async function handleDogNo() {
    if (!confirmDog) return
    const id = confirmDog.id
    setConfirmDog(null)
    setDogs(prev => prev.filter(dog => dog.id !== id))
    await db.from('dogtracker_dogs').delete().eq('id', id)
  }

  const activeCircle = !editingTab ? circles[tabKey(selected)] : null

  if (!allowed) {
    return (
      <div className="text-white min-h-screen flex flex-col">
        <Navbar hideBanner />
        <div className="flex-1 flex items-center justify-center p-6">
          {geo === 'checking' ? (
            <Spinner />
          ) : (
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-600 mb-2">404</p>
              <p className="text-gray-500 text-sm">Ta strona nie istnieje.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="text-white min-h-screen flex flex-col">
      <Navbar hideBanner />
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
        <h1 className="text-2xl font-extrabold tracking-wide text-yellow-400 mb-1">DOG TRACKER</h1>
        <div className="flex border border-gray-700 rounded-xl overflow-hidden bg-gray-950">
          <aside className="w-56 shrink-0 flex flex-col border-r border-gray-700">
            {TABS.map(tab => {
              const active = selected.metin === tab.metin && selected.tier === tab.tier
              const isEditingThis = sameTab(editingTab, tab)
              return (
                <div
                  key={tabKey(tab)}
                  className={`flex-1 flex border-b border-gray-800 last:border-b-0 ${active ? 'bg-yellow-400' : ''}`}
                >
                  <button
                    onClick={() => setSelected(tab)}
                    className={`flex-1 flex items-center px-3 text-left text-sm font-semibold transition-colors ${
                      active ? 'text-gray-950' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {tab.metin} {tab.tier}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleEdit(tab)}
                      title="Zaznacz obszar na mapie"
                      className={`px-2 flex items-center text-xs transition-colors ${
                        isEditingThis
                          ? 'bg-red-500 text-white'
                          : active
                            ? 'text-gray-800 hover:text-gray-950'
                            : 'text-gray-500 hover:text-gray-200'
                      }`}
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )
            })}
          </aside>

          <div className="flex items-center justify-center">
            {loading ? (
              <Spinner />
            ) : map ? (
              <div
                ref={mapWrapRef}
                onClick={handleMapClick}
                className={`relative inline-block ${editingTab ? 'cursor-crosshair' : 'cursor-pointer'}`}
              >
                <img
                  src={map.image_url}
                  alt={map.name}
                  draggable="false"
                  className="block max-w-full max-h-[80vh] object-contain select-none"
                />
                {activeCircle && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/40 border-2 border-red-500 pointer-events-none"
                    style={{ left: `${activeCircle.x}%`, top: `${activeCircle.y}%`, width: 48, height: 48 }}
                  />
                )}
                {dogs.map(dog => (
                  <button
                    key={dog.id}
                    onClick={e => { e.stopPropagation(); setConfirmDog(dog) }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 hover:scale-125 transition-transform"
                    style={{ left: `${dog.x}%`, top: `${dog.y}%` }}
                  >
                    <span className="text-2xl leading-none drop-shadow">🐕</span>
                    <span className="text-[10px] font-bold text-white bg-black/70 rounded px-1">CH{dog.channel}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm p-6">Mapa nie znaleziona.</p>
            )}
          </div>
        </div>
        {editingTab && (
          <p className="text-xs text-yellow-400">
            Kliknij na mapę, aby zaznaczyć obszar dla: {editingTab.metin} {editingTab.tier}
          </p>
        )}
      </div>

      {pendingClick && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCancelDog}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72 flex flex-col items-center gap-4 shadow-xl shadow-black/50"
          >
            <p className="text-xl font-extrabold text-red-500 tracking-wide">DOG HERE</p>
            <div className="w-full">
              <p className="text-xs text-gray-400 mb-2 text-center">Choose channel</p>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map(ch => (
                  <button
                    key={ch}
                    onClick={() => setSelectedChannel(ch)}
                    className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      selectedChannel === ch
                        ? 'bg-yellow-400 border-yellow-400 text-gray-950'
                        : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    CH{ch}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleCancelDog}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSendDog}
                disabled={!selectedChannel || sending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:hover:bg-red-500 text-white transition-colors"
              >
                SEND
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmDog(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-72 flex flex-col items-center gap-4 shadow-xl shadow-black/50"
          >
            <p className="text-lg font-bold text-gray-100 text-center">Is dog still here?</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleDogNo}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-colors"
              >
                NO
              </button>
              <button
                onClick={() => setConfirmDog(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 transition-colors"
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
