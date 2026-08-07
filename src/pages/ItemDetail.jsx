import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import SealPicker from '../components/SealPicker'
import Spinner from '../components/Spinner'
import { formatYang, parseYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import ItemImage from '../components/ItemImage'

const STEP_LABELS = {
  0: 'Craft',
  1: '+0 → +1', 2: '+1 → +2', 3: '+2 → +3',
  4: '+3 → +4', 5: '+4 → +5', 6: '+5 → +6',
  7: '+6 → +7', 8: '+7 → +8', 9: '+8 → +9',
}

const SCROLL_ORDER = [
  'Blessing Scroll', 'Dragon Scroll', 'Scroll of Honor',
  'Blacksmith Handbook', 'Scroll of War', 'Magic Stone',
]

function PriceInput({ materialId, value, onPriceChange }) {
  return (
    <input
      type="text"
      placeholder="e.g. 50kk"
      value={value ?? ''}
      onChange={e => onPriceChange(materialId, e.target.value)}
      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 w-28 text-right text-sm focus:outline-none focus:border-yellow-400 shrink-0 transition-colors"
    />
  )
}

function MatRow({ mat, quantity, rawValue, price, onPriceChange, formatYang }) {
  const lineTotal = (parseFloat(price) || 0) * quantity
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {mat.image_url
          ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain" />
          : <span className="text-lg">🧪</span>}
      </div>
      <span className="flex-1 text-sm text-gray-200 truncate">{mat.name}</span>
      <span className="text-gray-500 text-xs shrink-0">×{quantity}</span>
      <PriceInput materialId={mat.id} value={rawValue} onPriceChange={onPriceChange} />
      <span className="text-yellow-400 text-sm w-24 text-right font-mono shrink-0">{formatYang(lineTotal)}</span>
    </div>
  )
}

export default function ItemDetail() {
  const { itemId } = useParams()
  const [item, setItem] = useState(null)
  const [grouped, setGrouped] = useState({})
  const [yangCosts, setYangCosts] = useState({})
  const [scrolls, setScrolls] = useState([])
  const [seals, setSeals] = useState([])
  const [selectedScroll, setSelectedScroll] = useState({})
  const [selectedSeals, setSelectedSeals] = useState({})
  const [prices, setPrices] = useState({})
  const [rawInputs, setRawInputs] = useState({})
  const [pity, setPity] = useState({})
  const [includeCraft, setIncludeCraft] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('items').select('*').eq('id', itemId).single(),
      supabase.from('item_materials').select('quantity, step, material:materials(id, name, image_url)').eq('item_id', itemId).order('step'),
      supabase.from('item_step_yang').select('step, yang_cost').eq('item_id', itemId),
      supabase.from('materials').select('id, name, image_url').eq('is_upgrade_scroll', true).order('name'),
      supabase.from('materials').select('id, name, image_url').eq('is_seal', true).order('name'),
    ]).then(([itemRes, matsRes, yangRes, scrollsRes, sealsRes]) => {
      setItem(itemRes.data)

      const g = {}
      for (const row of matsRes.data ?? []) {
        if (!g[row.step]) g[row.step] = []
        g[row.step].push(row)
      }
      setGrouped(g)

      const yc = {}
      for (const row of yangRes.data ?? []) yc[row.step] = row.yang_cost
      setYangCosts(yc)

      const sorted = (scrollsRes.data ?? []).sort((a, b) => {
        const ai = SCROLL_ORDER.findIndex(n => a.name.toLowerCase().includes(n.toLowerCase()))
        const bi = SCROLL_ORDER.findIndex(n => b.name.toLowerCase().includes(n.toLowerCase()))
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      setScrolls(sorted)
      setSeals(sealsRes.data ?? [])

      const war = sorted.find(s => s.name.toLowerCase().includes('scroll of war'))
      const magic = sorted.find(s => s.name.toLowerCase().includes('magic stone'))
      if (war || magic) {
        setSelectedScroll({
          1: war?.id ?? '', 2: war?.id ?? '', 3: war?.id ?? '', 4: war?.id ?? '',
          5: magic?.id ?? '', 6: magic?.id ?? '', 7: magic?.id ?? '', 8: magic?.id ?? '', 9: magic?.id ?? '',
        })
      }

      const saved = localStorage.getItem(`prices_${itemId}`)
      if (saved) setPrices(JSON.parse(saved))

      setLoading(false)
    })
  }, [itemId])

  function handlePriceChange(materialId, raw) {
    setRawInputs(prev => ({ ...prev, [materialId]: raw }))
    const parsed = parseYang(raw)
    const updated = { ...prices, [materialId]: parsed === '' ? '' : parsed }
    setPrices(updated)
    localStorage.setItem(`prices_${itemId}`, JSON.stringify(updated))
  }

  function getPity(step) { return Math.max(1, parseInt(pity[step]) || 1) }
  function matCost(rows) { return rows.reduce((s, r) => s + (parseFloat(prices[r.material.id]) || 0) * r.quantity, 0) }
  function scrollCost(step) { const id = selectedScroll[step]; return id ? (parseFloat(prices[id]) || 0) : 0 }
  function sealsCost(step) { return (selectedSeals[step] ?? []).reduce((s, id) => s + (parseFloat(prices[id]) || 0), 0) }
  function stepTotal(step) { return (matCost(grouped[step] ?? []) + (yangCosts[step] ?? 0) + scrollCost(step) + sealsCost(step)) * getPity(step) }

  const allSteps = [...new Set([...Object.keys(grouped).map(Number), ...Object.keys(yangCosts).map(Number)])].sort((a, b) => a - b)
  const total = allSteps.reduce((s, step) => (step === 0 && !includeCraft) ? s : s + stepTotal(step), 0)

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            {/* Item header */}
            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {itemImages(item).length > 0
                  ? <ItemImage images={itemImages(item)} alt={item.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">⚔️</span>}
              </div>
              <h1 className="text-2xl font-bold text-yellow-400">{item?.name}</h1>
            </div>

            {allSteps.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">No materials defined for this item.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {allSteps.map(step => {
                  const scrollId = selectedScroll[step] ?? ''
                  const scrollMat = scrolls.find(s => s.id === scrollId)
                  const stepSealMats = (selectedSeals[step] ?? []).map(id => seals.find(s => s.id === id)).filter(Boolean)
                  const hasExtras = scrollMat || stepSealMats.length > 0

                  return (
                    <div key={step} className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                      {/* Step header bar */}
                      <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700 flex-wrap gap-2">
                        <h2 className="text-xs font-bold text-yellow-400 uppercase tracking-widest">
                          {STEP_LABELS[step]}
                        </h2>
                        {step !== 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {scrolls.length > 0 && (
                              <select
                                value={scrollId}
                                onChange={e => setSelectedScroll(prev => ({ ...prev, [step]: e.target.value }))}
                                className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-400"
                              >
                                <option value="">No scroll</option>
                                {scrolls.map(s => {
                                  const isMagic = s.name.toLowerCase().includes('magic stone')
                                  return <option key={s.id} value={s.id}>{isMagic ? `⭐ ${s.name}` : s.name}</option>
                                })}
                              </select>
                            )}
                            {seals.length > 0 && (
                              <SealPicker
                                seals={seals}
                                selected={selectedSeals[step] ?? []}
                                onChange={val => setSelectedSeals(prev => ({ ...prev, [step]: val }))}
                              />
                            )}
                            <label className="flex items-center gap-1.5 text-xs text-gray-400">
                              Pity:
                              <input
                                type="number"
                                min="1"
                                value={pity[step] ?? 1}
                                onChange={e => setPity(prev => ({ ...prev, [step]: e.target.value }))}
                                className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 w-14 text-center text-xs text-white focus:outline-none focus:border-yellow-400"
                              />
                              {getPity(step) > 1 && <span className="text-yellow-400 font-bold">×{getPity(step)}</span>}
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Step body */}
                      <div className="px-5 py-4 flex flex-col gap-3">
                        {/* Yang fee */}
                        {yangCosts[step] !== undefined && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                              <span className="text-lg">💰</span>
                            </div>
                            <span className="flex-1 text-sm text-gray-400">Yang fee</span>
                            <span className="text-yellow-400 text-sm font-mono">{formatYang(yangCosts[step])}</span>
                          </div>
                        )}

                        {(grouped[step] ?? []).map(row => (
                          <MatRow key={row.material.id} mat={row.material} quantity={row.quantity} rawValue={rawInputs[row.material.id]} price={prices[row.material.id]} onPriceChange={handlePriceChange} formatYang={formatYang} />
                        ))}

                        {hasExtras && (
                          <div className="border-t border-gray-700/60 pt-3 flex flex-col gap-3">
                            {scrollMat && <MatRow mat={scrollMat} quantity={1} rawValue={rawInputs[scrollMat.id]} price={prices[scrollMat.id]} onPriceChange={handlePriceChange} formatYang={formatYang} />}
                            {stepSealMats.map(s => <MatRow key={s.id} mat={s} quantity={1} rawValue={rawInputs[s.id]} price={prices[s.id]} onPriceChange={handlePriceChange} formatYang={formatYang} />)}
                          </div>
                        )}
                      </div>

                      {/* Subtotal */}
                      <div className="flex justify-between items-center px-5 py-3 bg-gray-800/40 border-t border-gray-700">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                          Subtotal{step !== 0 && getPity(step) > 1 ? ` ×${getPity(step)}` : ''}
                        </span>
                        <span className="text-sm font-bold text-yellow-400 font-mono">{formatYang(stepTotal(step))}</span>
                      </div>
                    </div>
                  )
                })}

                {/* Total card */}
                <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1">
                  {allSteps.includes(0) && (
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-4 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeCraft}
                        onChange={e => setIncludeCraft(e.target.checked)}
                        className="accent-yellow-400 w-4 h-4"
                      />
                      Include craft cost
                    </label>
                  )}
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
