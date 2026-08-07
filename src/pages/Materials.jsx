import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import AddMaterialModal from '../components/AddMaterialModal'
import EditMaterialModal from '../components/EditMaterialModal'
import MaterialPriceCell from '../components/MaterialPriceCell'
import Spinner from '../components/Spinner'
import { supabase } from '../supabaseClient'
import { usePriceBook, computePrice, buildRecipeMap, buildYangCostMap } from '../utils/priceBook'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'none', label: 'No tag' },
  { key: 'scroll', label: 'Scroll' },
  { key: 'seal', label: 'Seal' },
  { key: 'item', label: 'Item' },
  { key: 'craftable', label: 'Craftable' },
]

function matchesFilter(mat, filter) {
  switch (filter) {
    case 'none': return !mat.is_upgrade_scroll && !mat.is_seal && !mat.is_item
    case 'scroll': return mat.is_upgrade_scroll
    case 'seal': return mat.is_seal
    case 'item': return mat.is_item
    case 'craftable': return mat.is_craftable
    default: return true
  }
}

export default function Materials() {
  const { isAdmin } = useAuth()
  const [materials, setMaterials] = useState([])
  const [recipes, setRecipes] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const { rawInputs, setPrice, importPrices } = usePriceBook()
  const fileInputRef = useRef(null)

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('material_materials').select('material_id, component_id, quantity'),
    ]).then(([matsRes, recipeRes]) => {
      setMaterials(matsRes.data ?? [])
      setRecipes(buildRecipeMap(recipeRes.data))
      setLoading(false)
    })
  }, [])

  function handleAdded(mat) {
    setMaterials(prev => [...prev, mat].sort((a, b) => a.name.localeCompare(b.name)))
  }
  function handleUpdated(mat) {
    setMaterials(prev => prev.map(m => m.id === mat.id ? mat : m))
  }
  function handleDeleted(id) {
    setMaterials(prev => prev.filter(m => m.id !== id))
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(rawInputs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baerim-prices-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid file')
      importPrices(parsed)
    } catch {
      alert('Could not read this file — make sure it is a prices file exported from this site.')
    }
  }

  const yangCosts = buildYangCostMap(materials)

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-100">Materials</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold px-3 py-2 rounded-xl text-sm transition-colors"
              title="Download your entered prices as a file"
            >
              ⬇ Export prices
            </button>
            <button
              onClick={handleImportClick}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold px-3 py-2 rounded-xl text-sm transition-colors"
              title="Restore prices from a previously exported file"
            >
              ⬆ Import prices
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                + Add material
              </button>
            )}
          </div>
        </div>

        {materials.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            <input
              type="text"
              placeholder="Search material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filter === f.key ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const visible = materials.filter(mat => matchesFilter(mat, filter) && mat.name.toLowerCase().includes(search.toLowerCase()))
          if (loading) return <Spinner />
          if (materials.length === 0) {
            return (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">🧪</span>
                <p className="text-sm">No materials yet.</p>
              </div>
            )
          }
          if (visible.length === 0) {
            return (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">🔍</span>
                <p className="text-sm">No materials match your search.</p>
              </div>
            )
          }
          return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {visible.map(mat => {
              const Wrapper = mat.is_craftable ? Link : 'div'
              const wrapperProps = mat.is_craftable ? { to: `/materials/${mat.id}` } : {}
              return (
                <Wrapper
                  key={mat.id}
                  {...wrapperProps}
                  className={`group relative bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col items-center transition-all duration-200 hover:border-gray-500 hover:bg-gray-800 ${mat.is_craftable ? 'hover:border-green-400/50' : ''}`}
                >
                  <div className="w-16 h-16 flex items-center justify-center mb-3">
                    {mat.image_url
                      ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain drop-shadow" />
                      : <span className="text-4xl">🧪</span>}
                  </div>
                  <span className="text-sm font-semibold text-gray-100 text-center leading-tight line-clamp-2 min-h-[2.5rem] flex items-center mb-2">
                    {mat.name}
                  </span>
                  <div className="flex gap-1 flex-wrap justify-center items-start min-h-[24px] mb-3">
                    {mat.is_upgrade_scroll && (
                      <span className="text-xs bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full">Scroll</span>
                    )}
                    {mat.is_seal && (
                      <span className="text-xs bg-red-900/60 text-red-300 border border-red-700/50 px-2 py-0.5 rounded-full">Seal</span>
                    )}
                    {mat.is_item && (
                      <span className="text-xs bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full">Item</span>
                    )}
                    {mat.is_craftable && (
                      <span className="text-xs bg-green-900/60 text-green-300 border border-green-700/50 px-2 py-0.5 rounded-full">Craftable</span>
                    )}
                  </div>
                  <MaterialPriceCell
                    material={mat}
                    rawValue={rawInputs[mat.id]}
                    computedValue={mat.is_craftable ? computePrice(mat.id, rawInputs, recipes, yangCosts) : undefined}
                    onPriceChange={setPrice}
                  />
                  {isAdmin && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(mat) }}
                      className="absolute top-2 right-2 text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-base"
                      title="Edit"
                    >
                      ✏️
                    </button>
                  )}
                </Wrapper>
              )
            })}
          </div>
          )
        })()}
      </div>

        </div>
      {showAdd && (
        <AddMaterialModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
      {editing && (
        <EditMaterialModal
          material={editing}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
