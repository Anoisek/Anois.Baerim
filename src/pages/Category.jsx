import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import AddItemModal from '../components/AddItemModal'
import Spinner from '../components/Spinner'

export default function Category() {
  const { categoryId } = useParams()
  const { isAdmin } = useAuth()
  const [category, setCategory] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').eq('id', categoryId).single(),
      supabase.from('items').select('*').eq('category_id', categoryId).order('name'),
    ]).then(([catRes, itemsRes]) => {
      setCategory(catRes.data)
      setItems(itemsRes.data ?? [])
      setLoading(false)
    })
  }, [categoryId])

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {category?.image_url && (
              <img src={category.image_url} alt={category.name} className="w-8 h-8 object-contain" />
            )}
            <h1 className="text-2xl font-bold text-gray-100">{category?.name ?? 'Chapter'}</h1>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              + Add item
            </button>
          )}
        </div>

        {loading ? <Spinner /> : items.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-sm">No items in this chapter yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map(item => (
              <Link
                key={item.id}
                to={`/chapter/${categoryId}/item/${item.id}`}
                className="group bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col items-center gap-4 transition-all duration-200 hover:border-yellow-400/50 hover:bg-gray-800 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5"
              >
                <div className="w-16 h-16 flex items-center justify-center">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-full h-full object-contain drop-shadow" />
                    : <span className="text-4xl">⚔️</span>}
                </div>
                <span className="text-sm font-semibold text-gray-100 text-center leading-tight group-hover:text-yellow-400 transition-colors">
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

        </div>
      {showModal && (
        <AddItemModal
          categoryId={categoryId}
          onClose={() => setShowModal(false)}
          onAdded={item => setItems(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}
    </div>
  )
}
