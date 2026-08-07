import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import { formatYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap,
  computeItemPrice, buildItemStepMap, buildItemYangMap, buildItemMaxPityMap, buildDefaultScrollMap,
  fetchGlobalPrices, makeMaterialPriceFn,
} from '../utils/priceBook'

const LIST_KEY = 'shopping_list'

function loadList() {
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY)) ?? []
  } catch {
    return []
  }
}

function saveList(ids) {
  localStorage.setItem(LIST_KEY, JSON.stringify(ids))
}

function loadItemChoices(itemId) {
  try {
    const raw = localStorage.getItem(`item_choices_${itemId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function ShoppingList() {
  const [allItems, setAllItems] = useState([])
  const [selectedIds, setSelectedIds] = useState(loadList)
  const [search, setSearch] = useState('')
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [allItemMaterials, setAllItemMaterials] = useState({})
  const [allItemItems, setAllItemItems] = useState({})
  const [allItemYang, setAllItemYang] = useState({})
  const [allItemMaxPity, setAllItemMaxPity] = useState({})
  const [defaultScrollByStep, setDefaultScrollByStep] = useState({})
  const [globalPrices, setGlobalPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const { rawInputs, mode } = usePriceBook()

  useEffect(() => {
    Promise.all([
      supabase.from('items').select('id, name, image_url, image_urls, category_id').order('name'),
      supabase.from('material_materials').select('material_id, component_id, quantity'),
      supabase.from('materials').select('id, craft_yang_cost'),
      supabase.from('item_materials').select('item_id, material_id, quantity, step'),
      supabase.from('item_items').select('item_id, component_item_id, quantity, step'),
      supabase.from('item_step_yang').select('item_id, step, yang_cost, max_pity'),
      supabase.from('materials').select('id, name, image_url').eq('is_upgrade_scroll', true).order('name'),
      fetchGlobalPrices(),
    ]).then(([itemsRes, recipeRes, allMatsRes, allItemMatsRes, allItemItemsRes, allItemYangRes, scrollsRes, globalPricesMap]) => {
      setAllItems(itemsRes.data ?? [])
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(allMatsRes.data))
      setAllItemMaterials(buildItemStepMap(allItemMatsRes.data))
      setAllItemItems(buildItemStepMap(allItemItemsRes.data))
      setAllItemYang(buildItemYangMap(allItemYangRes.data))
      setAllItemMaxPity(buildItemMaxPityMap(allItemYangRes.data))
      setDefaultScrollByStep(buildDefaultScrollMap(scrollsRes.data))
      setGlobalPrices(globalPricesMap)
      setLoading(false)
    })
  }, [])

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts })

  const ctx = {
    materialPriceFn: priceFn,
    itemMaterials: allItemMaterials,
    itemItems: allItemItems,
    itemYang: allItemYang,
    itemMaxPity: allItemMaxPity,
    defaultScrollByStep,
  }

  const selectedItems = selectedIds.map(id => allItems.find(i => i.id === id)).filter(Boolean)
  const grandTotal = selectedItems.reduce((s, it) => s + computeItemPrice(it.id, ctx), 0)

  function addItem(id) {
    if (selectedIds.includes(id)) return
    const next = [...selectedIds, id]
    setSelectedIds(next)
    saveList(next)
    setSearch('')
  }

  function removeItem(id) {
    const next = selectedIds.filter(x => x !== id)
    setSelectedIds(next)
    saveList(next)
  }

  function resetPityToOne() {
    for (const id of selectedIds) {
      const choices = loadItemChoices(id) ?? { selectedScroll: {}, selectedSeals: {}, pity: {}, includeCraft: true }
      const nextPity = {}
      for (let s = 1; s <= 9; s++) nextPity[s] = 1
      choices.pity = nextPity
      localStorage.setItem(`item_choices_${id}`, JSON.stringify(choices))
    }
    setRefreshTick(t => t + 1)
  }

  function setPityToMax() {
    for (const id of selectedIds) {
      const choices = loadItemChoices(id) ?? { selectedScroll: {}, selectedSeals: {}, pity: {}, includeCraft: true }
      const maxMap = allItemMaxPity[id] ?? {}
      const nextPity = { ...choices.pity }
      for (let s = 1; s <= 9; s++) {
        if (maxMap[s]) nextPity[s] = maxMap[s]
      }
      choices.pity = nextPity
      localStorage.setItem(`item_choices_${id}`, JSON.stringify(choices))
    }
    setRefreshTick(t => t + 1)
  }

  const filtered = search.trim().length >= 2
    ? allItems.filter(i => !selectedIds.includes(i.id) && i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : []

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shopping List' }]} />
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-100">Shopping List</h1>
          {mode === 'global' && (
            <span className="text-xs bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-1 rounded-full">
              Global Prices
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 mb-4 relative">
          <input
            type="text"
            placeholder="Search item to add..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          />
          {filtered.length > 0 && (
            <div className="flex flex-col gap-1 bg-gray-800 border border-gray-700 rounded-lg p-2">
              {filtered.map(it => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addItem(it.id)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 text-left"
                >
                  {itemImages(it).length > 0
                    ? <img src={itemImages(it)[0]} alt={it.name} className="w-7 h-7 object-contain" />
                    : <span className="w-7 text-center text-lg">⚔️</span>}
                  <span className="text-sm text-white flex-1">{it.name}</span>
                  <span className="text-xs text-yellow-400 shrink-0">+ Add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={resetPityToOne}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              🔄 Reset pity to 1 (all items)
            </button>
            <button
              type="button"
              onClick={setPityToMax}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              ⬆ Set pity to max (all items)
            </button>
          </div>
        )}

        {loading ? <Spinner /> : selectedItems.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
            <span className="text-5xl">🛒</span>
            <p className="text-sm">No items in the list yet — search above to add some.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {selectedItems.map(item => {
                const price = computeItemPrice(item.id, ctx)
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-700">
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                      {itemImages(item).length > 0
                        ? <img src={itemImages(item)[0]} alt={item.name} className="w-full h-full object-contain" />
                        : <span className="text-lg">⚔️</span>}
                    </div>
                    <Link to={`/chapter/${item.category_id}/item/${item.id}`} className="flex-1 text-sm text-gray-200 hover:text-yellow-400 transition-colors truncate">
                      {item.name}
                    </Link>
                    <span className="text-yellow-400 text-sm font-mono shrink-0">{formatYang(price)}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="bg-gray-900 border border-yellow-400/20 rounded-2xl px-6 py-5 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-semibold">Grand total</span>
                <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(grandTotal)}</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
