import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'

function dedupeById(rows) {
  return Array.from(new Map(rows.map(r => [r.id, r])).values())
}

function UsageRow({ to, image, name, emoji }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-yellow-400/50 hover:bg-gray-800 transition-colors">
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {image ? <img src={image} alt={name} className="w-full h-full object-contain" /> : <span className="text-lg">{emoji}</span>}
      </div>
      <span className="text-sm text-gray-200">{name}</span>
    </Link>
  )
}

export default function MaterialUsage() {
  const { materialId } = useParams()
  const [material, setMaterial] = useState(null)
  const [usedInItems, setUsedInItems] = useState([])
  const [usedInMaterials, setUsedInMaterials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('id, name, image_url').eq('id', materialId).single(),
      supabase.from('item_materials').select('item:items(id, name, image_url, category_id)').eq('material_id', materialId),
      supabase.from('material_materials').select('material:materials!material_materials_material_id_fkey(id, name, image_url)').eq('component_id', materialId),
    ]).then(([matRes, itemRows, matRows]) => {
      setMaterial(matRes.data)
      setUsedInItems(dedupeById((itemRows.data ?? []).map(r => r.item).filter(Boolean)))
      setUsedInMaterials(dedupeById((matRows.data ?? []).map(r => r.material).filter(Boolean)))
      setLoading(false)
    })
  }, [materialId])

  const isEmpty = usedInItems.length === 0 && usedInMaterials.length === 0

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            <Breadcrumbs items={[
              { label: 'Home', to: '/' },
              { label: 'Materials', to: '/materials' },
              { label: material?.name ?? 'Material', to: material?.id ? `/materials/${material.id}` : undefined },
              { label: 'Usage' },
            ]} />

            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {material?.image_url
                  ? <img src={material.image_url} alt={material.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">🧪</span>}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-yellow-400">{material?.name}</h1>
                <p className="text-sm text-gray-500">Used in</p>
              </div>
            </div>

            {isEmpty ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">Not used anywhere yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {usedInItems.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Items</h2>
                    <div className="flex flex-col gap-2">
                      {usedInItems.map(item => (
                        <UsageRow key={item.id} to={`/chapter/${item.category_id}/item/${item.id}`} image={item.image_url} name={item.name} emoji="⚔️" />
                      ))}
                    </div>
                  </div>
                )}
                {usedInMaterials.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Materials</h2>
                    <div className="flex flex-col gap-2">
                      {usedInMaterials.map(mat => (
                        <UsageRow key={mat.id} to={`/materials/${mat.id}`} image={mat.image_url} name={mat.name} emoji="🧪" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  )
}
