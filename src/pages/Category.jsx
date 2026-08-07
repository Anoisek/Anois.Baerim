import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Tile from '../components/Tile'
import AddSubcategoryModal from '../components/AddSubcategoryModal'
import EditSubcategoryModal from '../components/EditSubcategoryModal'
import Spinner from '../components/Spinner'

export default function Category() {
  const { categoryId } = useParams()
  const { isAdmin } = useAuth()
  const [category, setCategory] = useState(null)
  const [subcategories, setSubcategories] = useState([])
  const [hasUncategorized, setHasUncategorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').eq('id', categoryId).single(),
      supabase.from('subcategories').select('*').eq('category_id', categoryId).order('created_at'),
      supabase.from('items').select('id').eq('category_id', categoryId).is('subcategory_id', null),
    ]).then(([catRes, subRes, uncatRes]) => {
      setCategory(catRes.data)
      setSubcategories(subRes.data ?? [])
      setHasUncategorized((uncatRes.data ?? []).length > 0)
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
              + Add category
            </button>
          )}
        </div>

        {loading ? <Spinner /> : subcategories.length === 0 && !hasUncategorized ? (
          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-sm">No categories in this chapter yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {subcategories.map(sub => (
              <Tile
                key={sub.id}
                to={`/chapter/${categoryId}/sub/${sub.id}`}
                image={sub.image_url}
                emoji="📦"
                label={sub.name}
                onEdit={isAdmin ? () => setEditing(sub) : undefined}
              />
            ))}
            {hasUncategorized && (
              <Tile
                to={`/chapter/${categoryId}/sub/none`}
                emoji="🗂️"
                label="Uncategorized"
              />
            )}
          </div>
        )}
      </div>

        </div>
      {showModal && (
        <AddSubcategoryModal
          categoryId={categoryId}
          onClose={() => setShowModal(false)}
          onAdded={sub => setSubcategories(prev => [...prev, sub])}
        />
      )}
      {editing && (
        <EditSubcategoryModal
          subcategory={editing}
          onClose={() => setEditing(null)}
          onUpdated={sub => setSubcategories(prev => prev.map(s => s.id === sub.id ? sub : s))}
          onDeleted={id => setSubcategories(prev => prev.filter(s => s.id !== id))}
        />
      )}
    </div>
  )
}
