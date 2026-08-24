import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { getToken } from '../authClient'

const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL

// The full "unofficial" code list (~4.5k entries, no per-item names) rarely changes
// and is the same for every picker instance on the page — cache it once per session
// instead of re-fetching every time an admin opens the modal.
let unofficialCache = null

export default function IconDbPicker({ onUploaded }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('official') // 'official' | 'unofficial'
  const [query, setQuery] = useState('')
  const [officialCodes, setOfficialCodes] = useState([])
  const [unofficialCodes, setUnofficialCodes] = useState(unofficialCache ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [importingCode, setImportingCode] = useState(null)
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  function loadOfficial(q) {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    fetch(`${WORKER_URL}/icondb/search?set=official&q=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(data => {
        if (requestId !== requestIdRef.current) return
        if (data.error) { setError(data.error); return }
        setOfficialCodes(data.codes)
      })
      .catch(() => { if (requestId === requestIdRef.current) setError('Search failed.') })
      .finally(() => { if (requestId === requestIdRef.current) setLoading(false) })
  }

  function loadUnofficial() {
    if (unofficialCache) { setUnofficialCodes(unofficialCache); return }
    setLoading(true)
    setError('')
    fetch(`${WORKER_URL}/icondb/search?set=unofficial`)
      .then(res => res.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        unofficialCache = data.codes
        setUnofficialCodes(data.codes)
      })
      .catch(() => setError('Could not load the unofficial icon list.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open) return
    setQuery('')
    setTab('official')
    loadOfficial('')
  }, [open])

  function switchTab(next) {
    setTab(next)
    setQuery('')
    if (next === 'unofficial') loadUnofficial()
    else loadOfficial('')
  }

  function handleQueryChange(value) {
    setQuery(value)
    if (tab === 'official') {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => loadOfficial(value), 300)
    }
  }

  async function pick(code) {
    setImportingCode(code)
    setError('')
    try {
      const token = getToken()
      const res = await fetch(`${WORKER_URL}/icondb/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'import failed')
      onUploaded(data.url)
      setOpen(false)
    } catch (err) {
      setError('Could not import that icon: ' + err.message)
    }
    setImportingCode(null)
  }

  const shownCodes = tab === 'official'
    ? officialCodes
    : (query.trim() ? unofficialCodes.filter(c => c.toLowerCase().includes(query.trim().toLowerCase())) : unofficialCodes)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-gray-800 border border-dashed border-gray-500 hover:border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-400 hover:text-white text-center transition-colors"
      >
        Choose from icon database
      </button>

      {open && (
        <Modal title="Icon database (m2icondb.com)" onClose={() => setOpen(false)} maxWidthClass="max-w-6xl">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-lg p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => switchTab('official')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === 'official' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  Official
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('unofficial')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === 'unofficial' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  Unofficial
                </button>
              </div>
              <input
                type="text"
                autoFocus
                placeholder={tab === 'official' ? 'Search icons by name...' : 'Filter by icon code...'}
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>

            {tab === 'unofficial' && (
              <p className="text-xs text-gray-500 -mt-1">Unofficial icons have no names — filtering matches the raw icon code shown on hover.</p>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {loading ? (
              <p className="text-gray-500 text-sm text-center py-10">Loading...</p>
            ) : shownCodes.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No icons found.</p>
            ) : (
              <div className="grid grid-cols-[repeat(8,minmax(0,1fr))] sm:grid-cols-[repeat(12,minmax(0,1fr))] lg:grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5 max-h-[65vh] overflow-y-auto content-start pr-1">
                {shownCodes.map(code => (
                  <button
                    key={code}
                    type="button"
                    title={code}
                    disabled={importingCode !== null}
                    onClick={() => pick(code)}
                    className={`aspect-square bg-gray-800 border rounded-md flex items-center justify-center p-1 transition-colors ${
                      importingCode === code ? 'border-yellow-400 opacity-60' : 'border-gray-700 hover:border-yellow-400'
                    } disabled:cursor-wait`}
                  >
                    <img src={`${WORKER_URL}/icondb/icon/${code}`} alt={code} loading="lazy" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500">
              {shownCodes.length} icon{shownCodes.length === 1 ? '' : 's'} shown &middot; from m2icondb.com &middot; picked icons are copied to our own storage.
            </p>
          </div>
        </Modal>
      )}
    </>
  )
}
