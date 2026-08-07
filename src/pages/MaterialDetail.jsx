import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import Spinner from '../components/Spinner'
import MaterialPriceCell from '../components/MaterialPriceCell'
import { formatYang } from '../utils/formatYang'
import { usePriceBook, computePrice, buildRecipeMap } from '../utils/priceBook'

export default function MaterialDetail() {
  const { materialId } = useParams()
  const [material, setMaterial] = useState(null)
  const [components, setComponents] = useState([])
  const [recipes, setRecipes] = useState({})
  const [loading, setLoading] = useState(true)
  const { rawInputs, setPrice } = usePriceBook()

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').eq('id', materialId).single(),
      supabase.from('material_materials').select('quantity, component:materials!material_materials_component_id_fkey(id, name, image_url, is_craftable)').eq('material_id', materialId),
      supabase.from('material_materials').select('material_id, component_id, quantity'),
    ]).then(([matRes, compRes, recipeRes]) => {
      setMaterial(matRes.data)
      setComponents(compRes.data ?? [])
      setRecipes(buildRecipeMap(recipeRes.data))
      setLoading(false)
    })
  }, [materialId])

  function priceOf(id) {
    return computePrice(id, rawInputs, recipes)
  }

  const total = components.reduce((s, row) => s + priceOf(row.component.id) * row.quantity, 0)

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {material?.image_url
                  ? <img src={material.image_url} alt={material.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">🧪</span>}
              </div>
              <h1 className="text-2xl font-bold text-yellow-400">{material?.name}</h1>
            </div>

            {components.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">No recipe defined for this material.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-gray-800/60 border-b border-gray-700">
                    <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Craft</h2>
                  </div>
                  <div className="px-5 py-4 flex flex-col gap-3">
                    {components.map(row => {
                      const unitPrice = priceOf(row.component.id)
                      const lineTotal = unitPrice * row.quantity
                      return (
                        <div key={row.component.id} className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                            {row.component.image_url
                              ? <img src={row.component.image_url} alt={row.component.name} className="w-full h-full object-contain" />
                              : <span className="text-lg">🧪</span>}
                          </div>
                          <span className="flex-1 text-sm text-gray-200 truncate">{row.component.name}</span>
                          <span className="text-gray-500 text-xs shrink-0">×{row.quantity}</span>
                          <MaterialPriceCell material={row.component} rawValue={rawInputs[row.component.id]} computedValue={unitPrice} onPriceChange={setPrice} />
                          <span className="text-yellow-400 text-sm w-24 text-right font-mono shrink-0">{formatYang(lineTotal)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-semibold">Total cost</span>
                    <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  )
}
