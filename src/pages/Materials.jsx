import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import AddMaterialModal from '../components/AddMaterialModal'
import EditMaterialModal from '../components/EditMaterialModal'
import MaterialPriceCell from '../components/MaterialPriceCell'
import PriceModeToggle from '../components/PriceModeToggle'
import Spinner from '../components/Spinner'
import ItemImage from '../components/ItemImage'
import { db } from '../dbClient'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap,
  fetchGlobalPrices, submitPricesToGlobal, makeMaterialPriceFn, FIXED_MATERIAL_PRICES,
} from '../utils/priceBook'
import { sortByCategoryTag } from '../utils/materialCategoryTags'
import { itemImages as materialImages } from '../utils/itemImages'

const FILTERS = [
  { key: 'all', labelKey: 'materials.filterAll' },
  { key: 'none', labelKey: 'materials.filterNoTag' },
  { key: 'scroll', labelKey: 'materials.filterScroll' },
  { key: 'seal', labelKey: 'materials.filterSeal' },
  { key: 'item', labelKey: 'materials.filterItem' },
  { key: 'craftable', labelKey: 'materials.filterCraftable' },
]

function matchesFilter(mat, filter) {
  switch (filter) {
    case 'none': return !mat.is_upgrade_scroll && !mat.is_seal && !mat.is_item
    case 'scroll': return mat.is_upgrade_scroll
    case 'seal': return mat.is_seal
    case 'item': return mat.is_item
    case 'craftable': return mat.is_craftable
    default: return true
  }
}

export default function Materials() {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const [materials, setMaterials] = useState([])
  const [recipes, setRecipes] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')
  const [chapterTab, setChapterTab] = useState('chapter1')
  const [search, setSearch] = useState('')
  const [globalPrices, setGlobalPrices] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [usedInItemIds, setUsedInItemIds] = useState(new Set())
  const [usedAsComponentIds, setUsedAsComponentIds] = useState(new Set())
  const { rawInputs, setPrice, importPrices, mode, setMode, manualOverrides, toggleManualOverride } = usePriceBook()
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      db.from('materials').select('*').order('name'),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      fetchGlobalPrices(),
      db.from('item_materials').select('material_id'),
    ]).then(([matsRes, recipeRes, globalPricesMap, itemMatsRes]) => {
      setMaterials(matsRes.data ?? [])
      setRecipes(buildRecipeMap(recipeRes.data))
      setGlobalPrices(globalPricesMap)
      setUsedInItemIds(new Set((itemMatsRes.data ?? []).map(r => r.material_id)))
      setUsedAsComponentIds(new Set((recipeRes.data ?? []).map(r => r.component_id)))
      setLoading(false)
    })
  }, [])

  async function handleSubmitToGlobal() {
    setSubmitting(true)
    const { accepted, rejected, skipped } = await submitPricesToGlobal(rawInputs)
    setGlobalPrices(await fetchGlobalPrices())
    setSubmitting(false)
    alert(t('materials.submitResult', {
      accepted,
      rejectedText: rejected > 0 ? t('materials.submitRejected', { count: rejected }) : '',
      skippedText: skipped > 0 ? t('materials.submitSkipped', { count: skipped }) : '',
    }))
  }

  function handleAdded(mat) {
    setMaterials(prev => [...prev, mat].sort((a, b) => a.name.localeCompare(b.name)))
  }
  function handleUpdated(mat) {
    setMaterials(prev => prev.map(m => m.id === mat.id ? mat : m))
  }
  function handleDeleted(id) {
    setMaterials(prev => prev.filter(m => m.id !== id))
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(rawInputs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baerim-prices-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid file')
      importPrices(parsed)
    } catch {
      alert(t('materials.importError'))
    }
  }

  const yangCosts = buildYangCostMap(materials)
  const noPriceIds = new Set(materials.filter(m => m.no_price).map(m => m.id))
  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts, manualOverrides, noPriceIds })

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('materials.title') }]} />
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-100">{t('materials.title')}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <PriceModeToggle mode={mode} setMode={setMode} />
            <button
              onClick={handleSubmitToGlobal}
              disabled={submitting}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold px-3 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
              title={t('materials.submitToGlobalTooltip')}
            >
              {submitting ? t('materials.submitting') : t('materials.submitToGlobal')}
            </button>
            <button
              onClick={handleExport}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold px-3 py-2 rounded-xl text-sm transition-colors"
              title={t('materials.exportTooltip')}
            >
              {t('materials.exportPrices')}
            </button>
            <button
              onClick={handleImportClick}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold px-3 py-2 rounded-xl text-sm transition-colors"
              title={t('materials.importTooltip')}
            >
              {t('materials.importPrices')}
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                {t('materials.addMaterial')}
              </button>
            )}
          </div>
        </div>

        {materials.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-xl p-1 self-start">
              <button
                onClick={() => setChapterTab('chapter1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chapterTab === 'chapter1' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                Materials
              </button>
              <button
                onClick={() => setChapterTab('pvp')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chapterTab === 'pvp' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                PVP
              </button>
            </div>
            <input
              type="text"
              placeholder={t('materials.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filter === f.key ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const visible = sortByCategoryTag(materials.filter(mat =>
            (chapterTab === 'pvp' ? mat.is_pvp : !mat.is_pvp) &&
            matchesFilter(mat, filter) &&
            mat.name.toLowerCase().includes(search.toLowerCase())
          ))
          if (loading) return <Spinner />
          if (materials.length === 0) {
            return (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">🧪</span>
                <p className="text-sm">{t('materials.noMaterialsYet')}</p>
              </div>
            )
          }
          if (visible.length === 0) {
            return (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">🔍</span>
                <p className="text-sm">{t('materials.noMatch')}</p>
              </div>
            )
          }
          return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {visible.map(mat => {
              const Wrapper = mat.is_craftable ? Link : 'div'
              const wrapperProps = mat.is_craftable ? { to: `/materials/${mat.id}` } : {}
              return (
                <Wrapper
                  key={mat.id}
                  {...wrapperProps}
                  className={`group relative bg-gray-900 border border-gray-700 rounded-2xl p-5 flex flex-col items-center transition-all duration-200 hover:border-gray-500 hover:bg-gray-800 ${mat.is_craftable ? 'hover:border-green-400/50' : ''}`}
                >
                  <div className="w-16 h-16 flex items-center justify-center mb-3">
                    {materialImages(mat).length > 0
                      ? <ItemImage images={materialImages(mat)} alt={mat.name} className="w-full h-full object-contain drop-shadow" />
                      : <span className="text-4xl">🧪</span>}
                  </div>
                  <span className="text-sm font-semibold text-gray-100 text-center leading-tight line-clamp-2 min-h-[2.5rem] flex items-center mb-2">
                    {mat.name}
                  </span>
                  <div className="flex gap-1 flex-wrap justify-center items-start min-h-[24px] mb-3">
                    {mat.is_upgrade_scroll && (
                      <span className="text-xs bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full">{t('materials.tagScroll')}</span>
                    )}
                    {mat.is_seal && (
                      <span className="text-xs bg-red-900/60 text-red-300 border border-red-700/50 px-2 py-0.5 rounded-full">{t('materials.tagSeal')}</span>
                    )}
                    {mat.is_item && (
                      <span className="text-xs bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full">{t('materials.tagItem')}</span>
                    )}
                    {mat.is_craftable && (
                      <span className="text-xs bg-green-900/60 text-green-300 border border-green-700/50 px-2 py-0.5 rounded-full">{t('materials.tagCraftable')}</span>
                    )}
                  </div>
                  {!mat.is_pvp && (
                    <>
                      {mat.is_craftable && mode !== 'global' && (
                        <label
                          className="flex items-center gap-1.5 text-[0.65rem] text-gray-400 hover:text-gray-300 mb-1.5 cursor-pointer select-none"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={manualOverrides.has(mat.id)}
                            onChange={() => {}}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); toggleManualOverride(mat.id) }}
                            className="accent-yellow-400 w-3 h-3"
                          />
                          {t('materials.manualPrice')}
                        </label>
                      )}
                      <MaterialPriceCell
                        material={mat}
                        rawValue={rawInputs[mat.id]}
                        computedValue={mode === 'global' || FIXED_MATERIAL_PRICES[mat.id] != null || (mat.is_craftable && !manualOverrides.has(mat.id)) ? priceFn(mat.id) : undefined}
                        onPriceChange={setPrice}
                        computed={mode === 'global' ? true : undefined}
                        manualOverride={manualOverrides.has(mat.id)}
                      />
                    </>
                  )}
                  {(usedInItemIds.has(mat.id) || usedAsComponentIds.has(mat.id)) && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/materials/${mat.id}/usage`) }}
                      className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-800/90 border border-gray-600 text-gray-300 hover:text-yellow-400 hover:border-yellow-400/50 transition-colors text-xs"
                      title={t('common.seeUsage')}
                    >
                      🔗
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(mat) }}
                      className="absolute top-2 right-2 text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-base"
                      title={t('common.edit')}
                    >
                      ✏️
                    </button>
                  )}
                </Wrapper>
              )
            })}
          </div>
          )
        })()}
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
