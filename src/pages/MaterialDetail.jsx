import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import Spinner from '../components/Spinner'
import MaterialPriceCell from '../components/MaterialPriceCell'
import { formatYang } from '../utils/formatYang'
import { usePriceBook, computePrice, buildRecipeMap, buildYangCostMap } from '../utils/priceBook'

export default function MaterialDetail() {
  const { materialId } = useParams()
  const [material, setMaterial] = useState(null)
  const [components, setComponents] = useState([])
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [pity, setPity] = useState(1)
  const [loading, setLoading] = useState(true)
  const { rawInputs, setPrice } = usePriceBook()

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').eq('id', materialId).single(),
      supabase.from('material_materials').select('quantity, component:materials!material_materials_component_id_fkey(id, name, image_url, is_craftable)').eq('material_id', materialId),
      supabase.from('material_materials').select('material_id, component_id, quantity'),
      supabase.from('materials').select('id, craft_yang_cost'),
    ]).then(([matRes, compRes, recipeRes, allMatsRes]) => {
      setMaterial(matRes.data)
      setComponents(compRes.data ?? [])
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(allMatsRes.data))
      setLoading(false)
    })
  }, [materialId])

  function priceOf(id) {
    return computePrice(id, rawInputs, recipes, craftYangCosts)
  }

  const craftYangFee = material?.craft_yang_cost ?? 0
  const effectivePity = Math.max(1, parseInt(pity) || 1)
  const subtotal = components.reduce((s, row) => s + priceOf(row.component.id) * row.quantity, craftYangFee)
  const total = subtotal * effectivePity

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

            {components.length === 0 && !craftYangFee ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">No recipe defined for this material.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700 flex-wrap gap-2">
                    <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Craft</h2>
                    <label className="flex items-center gap-1.5 text-xs text-gray-400">
                      Pity:
                      <input
                        type="number"
                        min="1"
                        value={pity}
                        onChange={e => setPity(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-14 text-center text-xs text-white focus:outline-none focus:border-yellow-400"
                      />
                      {effectivePity > 1 && <span className="text-yellow-400 font-bold">×{effectivePity}</span>}
                    </label>
                  </div>
                  <div className="px-5 py-4 flex flex-col gap-3">
                    {craftYangFee > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                          <span className="text-lg">💰</span>
                        </div>
                        <span className="flex-1 text-sm text-gray-400">Yang fee</span>
                        <span className="text-yellow-400 text-sm font-mono">{formatYang(craftYangFee)}</span>
                      </div>
                    )}
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

                  <div className="flex justify-between items-center px-5 py-3 bg-gray-800/40 border-t border-gray-700">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">
                      Subtotal{effectivePity > 1 ? ` ×${effectivePity}` : ''}
                    </span>
                    <span className="text-sm font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
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
