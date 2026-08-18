import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import MaterialPriceCell from '../components/MaterialPriceCell'
import MaterialTile from '../components/MaterialTile'
import PriceModeToggle from '../components/PriceModeToggle'
import ItemImage from '../components/ItemImage'
import { formatYang } from '../utils/formatYang'
import { usePriceBook, buildRecipeMap, buildYangCostMap, fetchGlobalPrices, makeMaterialPriceFn } from '../utils/priceBook'
import { itemImages as materialImages } from '../utils/itemImages'

export default function MaterialDetail() {
  const { t } = useTranslation()
  const { materialId } = useParams()
  const [material, setMaterial] = useState(null)
  const [components, setComponents] = useState([])
  const [variantRows, setVariantRows] = useState({}) // { [variant]: [{ material, quantity }] }
  const [variantYield, setVariantYield] = useState({}) // { [variant]: yield }
  const [activeVariant, setActiveVariant] = useState(1)
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [globalPrices, setGlobalPrices] = useState({})
  const [noPriceIds, setNoPriceIds] = useState(new Set())
  const [pity, setPity] = useState(1)
  const [loading, setLoading] = useState(true)
  const { rawInputs, setPrice, mode, setMode, manualOverrides } = usePriceBook()
  const navigate = useNavigate()

  useEffect(() => {
    setActiveVariant(1)
    Promise.all([
      db.from('materials').select('*').eq('id', materialId).single(),
      db.from('material_materials').select('quantity, variant, component_id').eq('material_id', materialId),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      db.from('materials').select('id, name, image_url, is_craftable, craft_yang_cost, no_price'),
      db.from('material_craft_variant_yield').select('variant, yield').eq('material_id', materialId),
      fetchGlobalPrices(),
    ]).then(([matRes, compRes, recipeRes, allMatsRes, yieldRes, globalPricesMap]) => {
      setMaterial(matRes.data)
      const materialsById = Object.fromEntries((allMatsRes.data ?? []).map(m => [m.id, m]))
      const compRows = (compRes.data ?? []).map(r => ({ ...r, component: materialsById[r.component_id] }))
      setComponents(compRows.filter(r => (r.variant ?? 1) === 1))
      const byVariant = {}
      for (const row of compRows) {
        const v = row.variant ?? 1
        if (!byVariant[v]) byVariant[v] = []
        byVariant[v].push({ material: row.component, quantity: row.quantity })
      }
      setVariantRows(byVariant)
      const vy = {}
      for (const row of yieldRes.data ?? []) vy[row.variant] = row.yield
      setVariantYield(vy)
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(allMatsRes.data))
      setGlobalPrices(globalPricesMap)
      setNoPriceIds(new Set((allMatsRes.data ?? []).filter(m => m.no_price).map(m => m.id)))
      setLoading(false)
    })
  }, [materialId])

  const variantNumbers = Object.keys(variantRows).map(Number).sort((a, b) => a - b)
  const variantCount = variantNumbers.length > 0 ? Math.max(...variantNumbers) : 0

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts, manualOverrides, noPriceIds })

  function priceOf(id) {
    return priceFn(id)
  }

  const craftYangFee = material?.craft_yang_cost ?? 0
  const effectivePity = Math.max(1, parseInt(pity) || 1)
  const subtotal = material ? priceOf(material.id) : 0
  const total = subtotal * effectivePity

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('materials.title'), to: '/materials' }, { label: material?.name ?? t('common.material') }]} />
            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl flex-wrap">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {material && materialImages(material).length > 0
                  ? <ItemImage images={materialImages(material)} alt={material.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">🧪</span>}
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-yellow-400">{material?.name}</h1>
                {material && !material.is_pvp && (
                  <MaterialPriceCell
                    material={material}
                    rawValue={rawInputs[material.id]}
                    computedValue={subtotal}
                    onPriceChange={setPrice}
                    computed={mode === 'global' || material.is_craftable ? true : undefined}
                  />
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <PriceModeToggle mode={mode} setMode={setMode} />
                <button
                  onClick={() => navigate(`/materials/${materialId}/usage`)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 px-2.5 py-1.5 rounded-full transition-colors"
                  title={t('materialDetail.usedInTooltip')}
                >
                  🔗 {t('materialDetail.usedIn')}
                </button>
              </div>
            </div>

            {!material?.is_craftable ? null : material.is_pvp ? (
              variantCount === 0 ? (
                <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                  <span className="text-5xl">📭</span>
                  <p className="text-sm">{t('materialDetail.noRecipe')}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {variantCount > 1 && (
                    <div className="flex items-center justify-center gap-4 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-2 self-center">
                      <button
                        type="button"
                        onClick={() => setActiveVariant(v => Math.max(1, v - 1))}
                        disabled={activeVariant === 1}
                        title={t('materialDetail.prevVariant')}
                        className="text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none px-1"
                      >
                        ‹
                      </button>
                      <span className="text-sm text-white font-semibold min-w-[6rem] text-center">
                        {t('materialDetail.variant', { current: activeVariant, count: variantCount })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveVariant(v => Math.min(variantCount, v + 1))}
                        disabled={activeVariant === variantCount}
                        title={t('materialDetail.nextVariant')}
                        className="text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none px-1"
                      >
                        ›
                      </button>
                    </div>
                  )}
                  <p className="text-center text-xs text-gray-400">
                    {t('materialDetail.produces', { count: variantYield[activeVariant] ?? 1 })}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {(variantRows[activeVariant] ?? []).map(row => (
                      <MaterialTile key={row.material.id} mat={row.material} quantity={row.quantity} />
                    ))}
                  </div>
                </div>
              )
            ) : components.length === 0 && !craftYangFee ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">{t('materialDetail.noRecipe')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700 flex-wrap gap-2">
                    <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest">{t('materialDetail.craft')}</h2>
                    <label className="flex items-center gap-1.5 text-xs text-gray-400">
                      {t('materialDetail.pity')}
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
                        <span className="flex-1 text-sm text-gray-400">{t('materialDetail.yangFee')}</span>
                        <span className="text-yellow-400 text-sm font-mono">{formatYang(craftYangFee)}</span>
                      </div>
                    )}
                    {components.map(row => {
                      const unitPrice = priceOf(row.component.id)
                      const lineTotal = unitPrice * row.quantity
                      return (
                        <div key={row.component.id} className="flex items-center gap-3 min-w-0">
                          <Link
                            to={`/materials/${row.component.id}`}
                            className="w-8 h-8 shrink-0 flex items-center justify-center hover:opacity-75 transition-opacity"
                            title={row.component.name}
                          >
                            {row.component.image_url
                              ? <img src={row.component.image_url} alt={row.component.name} className="w-full h-full object-contain" />
                              : <span className="text-lg">🧪</span>}
                          </Link>
                          <span className="flex-1 text-sm text-gray-200 truncate">{row.component.name}</span>
                          <span className="text-gray-500 text-xs shrink-0">×{row.quantity}</span>
                          <MaterialPriceCell material={row.component} rawValue={rawInputs[row.component.id]} computedValue={unitPrice} onPriceChange={setPrice} computed={mode === 'global' ? true : undefined} />
                          <span className="text-yellow-400 text-sm w-24 text-right font-mono shrink-0">{formatYang(lineTotal)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-between items-center px-5 py-3 bg-gray-800/40 border-t border-gray-700">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">
                      {t('materialDetail.subtotal')}{effectivePity > 1 ? ` ×${effectivePity}` : ''}
                    </span>
                    <span className="text-sm font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
                  </div>
                </div>

                <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-semibold">{t('materialDetail.totalCost')}</span>
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
