import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import ItemImage from '../components/ItemImage'
import MaterialPriceCell from '../components/MaterialPriceCell'
import EditMetinModal from '../components/EditMetinModal'
import { formatYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap,
  fetchGlobalPrices, makeMaterialPriceFn,
} from '../utils/priceBook'

function loadLoot(metinId) {
  try {
    const raw = localStorage.getItem(`metin_loot_${metinId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function MetinDetail() {
  const { metinId } = useParams()
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [metin, setMetin] = useState(null)
  const [drops, setDrops] = useState([]) // [{ material_id, alt_group, sort_order }], ordered
  const [materialsById, setMaterialsById] = useState({})
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [globalPrices, setGlobalPrices] = useState({})
  const [quantities, setQuantities] = useState({}) // { materialId: rawQty }
  const [metinsDestroyed, setMetinsDestroyed] = useState('')
  const [minutesSpent, setMinutesSpent] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const { rawInputs, setPrice, mode, manualOverrides, toggleManualOverride } = usePriceBook()

  async function reloadDrops() {
    const { data } = await db.from('metin_drops').select('material_id, alt_group, sort_order').eq('metin_id', metinId).order('sort_order')
    setDrops(data ?? [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      db.from('metins').select('*').eq('id', metinId).maybeSingle(),
      db.from('metin_drops').select('material_id, alt_group, sort_order').eq('metin_id', metinId).order('sort_order'),
      db.from('materials').select('*'),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      fetchGlobalPrices(),
    ]).then(([metinRes, dropsRes, materialsRes, recipeRes, globalPricesMap]) => {
      setMetin(metinRes.data)
      setDrops(dropsRes.data ?? [])
      const byId = {}
      for (const m of materialsRes.data ?? []) byId[m.id] = m
      setMaterialsById(byId)
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(materialsRes.data))
      setGlobalPrices(globalPricesMap)

      const saved = loadLoot(metinId)
      setQuantities(saved?.quantities ?? {})
      setMetinsDestroyed(saved?.metinsDestroyed ?? '')
      setMinutesSpent(saved?.minutesSpent ?? '')

      setLoading(false)
    })
  }, [metinId])

  useEffect(() => {
    if (loading) return
    localStorage.setItem(`metin_loot_${metinId}`, JSON.stringify({ quantities, metinsDestroyed, minutesSpent }))
  }, [metinId, loading, quantities, metinsDestroyed, minutesSpent])

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts, manualOverrides })

  async function persistDropOrder(materialId, newOrder) {
    setDrops(prev => prev.map(d => d.material_id === materialId ? { ...d, sort_order: newOrder } : d).sort((a, b) => a.sort_order - b.sort_order))
    await db.from('metin_drops').update({ sort_order: newOrder }).eq('metin_id', metinId).eq('material_id', materialId)
  }

  function moveDrop(index, delta) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= drops.length) return
    const a = drops[index]
    const b = drops[targetIndex]
    persistDropOrder(a.material_id, b.sort_order)
    persistDropOrder(b.material_id, a.sort_order)
  }

  const rows = drops.map(d => ({ ...d, material: materialsById[d.material_id] })).filter(r => r.material)
  const totalYang = rows.reduce((sum, r) => sum + priceFn(r.material_id) * (Number(quantities[r.material_id]) || 0), 0)
  const metinsDestroyedNum = Number(metinsDestroyed) || 0
  const minutesNum = Number(minutesSpent) || 0
  const yangPerMinute = minutesNum > 0 ? totalYang / minutesNum : 0
  const yangPerMetin = metinsDestroyedNum > 0 ? totalYang / metinsDestroyedNum : 0

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          {loading ? <Spinner /> : !metin ? (
            <>
              <Breadcrumbs items={[
                { label: t('common.home'), to: '/' },
                { label: t('systems.title'), to: '/systems' },
                { label: t('systems.metinCalculator'), to: '/systems/metin-calculator' },
              ]} />
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">Metin not found.</p>
              </div>
            </>
          ) : (
            <>
              <Breadcrumbs items={[
                { label: t('common.home'), to: '/' },
                { label: t('systems.title'), to: '/systems' },
                { label: t('systems.metinCalculator'), to: '/systems/metin-calculator' },
                { label: metin.name },
              ]} />

              <div className="flex items-center gap-5 mb-6 p-5 bg-gray-900 border border-gray-700 rounded-2xl flex-wrap">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                  {itemImages(metin).length > 0
                    ? <ItemImage images={itemImages(metin)} alt={metin.name} className="w-full h-full object-contain drop-shadow-lg" />
                    : <span className="text-4xl">🪨</span>}
                </div>
                <h1 className="text-2xl font-bold text-yellow-400 flex-1">{metin.name}</h1>
                {isAdmin && (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    ✏️ {t('common.edit')}
                  </button>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                  <span className="text-5xl">📭</span>
                  <p className="text-sm">No drops defined for this metin yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {rows.map((row, index) => {
                    const mat = row.material
                    const unitPrice = priceFn(mat.id)
                    const qty = Number(quantities[mat.id]) || 0
                    const lineTotal = unitPrice * qty
                    const canOverride = mat.is_craftable && mode !== 'global'
                    return (
                      <div key={mat.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-700">
                        {isAdmin && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveDrop(index, -1)}
                              disabled={index === 0}
                              title="Move up"
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 border border-gray-600 text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none transition-colors"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDrop(index, 1)}
                              disabled={index === rows.length - 1}
                              title="Move down"
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 border border-gray-600 text-gray-300 hover:text-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none transition-colors"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                        <Link to={`/materials/${mat.id}`} className="w-8 h-8 shrink-0 flex items-center justify-center hover:opacity-75 transition-opacity">
                          {mat.image_url
                            ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain" />
                            : <span className="text-lg">🧪</span>}
                        </Link>
                        <Link to={`/materials/${mat.id}`} className="flex-1 min-w-0 text-sm text-gray-200 hover:text-yellow-400 transition-colors truncate">
                          {mat.name}
                        </Link>
                        {row.alt_group && (
                          <span title="Alternative drop group — only one material from this group drops per metin" className="text-[10px] text-gray-500 border border-gray-700 rounded px-1.5 py-0.5 shrink-0">
                            grp {row.alt_group}
                          </span>
                        )}
                        {canOverride && (
                          <input
                            type="checkbox"
                            checked={manualOverrides?.has(mat.id) ?? false}
                            onChange={() => toggleManualOverride(mat.id)}
                            title={t('materials.manualPrice')}
                            className="accent-yellow-400 w-3.5 h-3.5 shrink-0"
                          />
                        )}
                        <input
                          type="number"
                          min="0"
                          placeholder="Qty"
                          value={quantities[mat.id] ?? ''}
                          onChange={e => setQuantities(prev => ({ ...prev, [mat.id]: e.target.value }))}
                          className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 w-16 text-center text-sm focus:outline-none focus:border-yellow-400 shrink-0"
                        />
                        <MaterialPriceCell
                          material={mat}
                          rawValue={rawInputs[mat.id]}
                          computedValue={unitPrice}
                          onPriceChange={setPrice}
                          computed={mode === 'global' ? true : undefined}
                          manualOverride={manualOverrides?.has(mat.id) ?? false}
                        />
                        <span className="text-yellow-400 text-sm w-24 text-right font-mono shrink-0">{formatYang(lineTotal)}</span>
                      </div>
                    )
                  })}

                  <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1 flex flex-col gap-4">
                    <div className="flex flex-wrap gap-4">
                      <label className="flex-1 min-w-[140px] flex flex-col gap-1">
                        <span className="text-xs text-gray-400">Metins destroyed</span>
                        <input
                          type="number"
                          min="0"
                          value={metinsDestroyed}
                          onChange={e => setMetinsDestroyed(e.target.value)}
                          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                        />
                      </label>
                      <label className="flex-1 min-w-[140px] flex flex-col gap-1">
                        <span className="text-xs text-gray-400">Minutes spent</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={minutesSpent}
                          onChange={e => setMinutesSpent(e.target.value)}
                          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                        />
                      </label>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 font-semibold">Total yang collected</span>
                      <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(totalYang)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-gray-700/60 pt-3">
                      <span className="text-gray-400">Yang / minute</span>
                      <span className="text-yellow-400 font-mono">{formatYang(yangPerMinute)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Yang / metin</span>
                      <span className="text-yellow-400 font-mono">{formatYang(yangPerMetin)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editing && metin && (
        <EditMetinModal
          metin={metin}
          onClose={() => setEditing(false)}
          onUpdated={updated => { setMetin(updated); reloadDrops() }}
          onDeleted={() => setMetin(null)}
        />
      )}
    </div>
  )
}
