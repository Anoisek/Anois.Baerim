import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { getToken } from '../authClient'

const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL
const PAGE_SIZE = 48

export default function IconDbPicker({ onUploaded }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [codes, setCodes] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [importingCode, setImportingCode] = useState(null)
  const [error, setError] = useState('')
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  function load(q, offset, append) {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    fetch(`${WORKER_URL}/icondb/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${offset}`)
      .then(res => res.json())
      .then(data => {
        if (requestId !== requestIdRef.current) return
        if (data.error) { setError(data.error); return }
        setCodes(prev => (append ? [...prev, ...data.codes] : data.codes))
        setTotal(data.total ?? 0)
      })
      .catch(() => { if (requestId === requestIdRef.current) setError('Search failed.') })
      .finally(() => { if (requestId === requestIdRef.current) setLoading(false) })
  }

  useEffect(() => {
    if (!open) return
    setQuery('')
    load('', 0, false)
  }, [open])

  function handleQueryChange(value) {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(value, 0, false), 300)
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
        <Modal title="Icon database (m2icondb.com)" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              autoFocus
              placeholder="Search icons..."
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-96 overflow-y-auto content-start">
              {codes.map(code => (
                <button
                  key={code}
                  type="button"
                  title={code}
                  disabled={importingCode !== null}
                  onClick={() => pick(code)}
                  className={`aspect-square bg-gray-800 border rounded-lg flex items-center justify-center p-1 transition-colors ${
                    importingCode === code ? 'border-yellow-400 opacity-60' : 'border-gray-600 hover:border-yellow-400'
                  } disabled:cursor-wait`}
                >
                  <img src={`${WORKER_URL}/icondb/icon/${code}`} alt={code} loading="lazy" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>

            {loading && <p className="text-gray-500 text-sm text-center">Loading...</p>}
            {!loading && codes.length === 0 && !error && (
              <p className="text-gray-500 text-sm text-center">No icons found.</p>
            )}
            {!loading && codes.length > 0 && codes.length < total && (
              <button
                type="button"
                onClick={() => load(query, codes.length, true)}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                Load more ({codes.length}/{total})
              </button>
            )}

            <p className="text-xs text-gray-500">Official icons from m2icondb.com, picked icons are copied to our own storage.</p>
          </div>
        </Modal>
      )}
    </>
  )
}
