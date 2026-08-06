import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import AddMaterialModal from '../components/AddMaterialModal'
import EditMaterialModal from '../components/EditMaterialModal'
import Spinner from '../components/Spinner'
import { supabase } from '../supabaseClient'

export default function Materials() {
  const { isAdmin } = useAuth()
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    supabase.from('materials').select('*').order('name').then(({ data }) => {
      setMaterials(data ?? [])
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

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Materials</h1>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              + Add material
            </button>
          )}
        </div>

        {loading ? <Spinner /> : materials.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">🧪</span>
            <p className="text-sm">No materials yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {materials.map(mat => (
              <div
                key={mat.id}
                className="group relative bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-200 hover:border-gray-500 hover:bg-gray-800"
              >
                <div className="w-16 h-16 flex items-center justify-center">
                  {mat.image_url
                    ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain drop-shadow" />
                    : <span className="text-4xl">🧪</span>}
                </div>
                <span className="text-sm font-semibold text-gray-100 text-center leading-tight">{mat.name}</span>
                <div className="flex gap-1 flex-wrap justify-center">
                  {mat.is_upgrade_scroll && (
                    <span className="text-xs bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full">Scroll</span>
                  )}
                  {mat.is_seal && (
                    <span className="text-xs bg-red-900/60 text-red-300 border border-red-700/50 px-2 py-0.5 rounded-full">Seal</span>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setEditing(mat)}
                    className="absolute top-2 right-2 text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-base"
                    title="Edit"
                  >
                    ✏️
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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
