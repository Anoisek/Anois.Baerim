import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
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
import { slugify } from '../utils/slug'
import { PageHeader, EmptyState, ViewToggle, useViewMode, PillButton, GridWrap } from './ui'

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

function TagBadges({ mat, t }) {
  return (
    <>
      {mat.is_upgrade_scroll && <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700/40 px-1.5 py-0.5 rounded-full">{t('materials.tagScroll')}</span>}
      {mat.is_seal && <span className="text-[10px] bg-red-900/50 text-red-300 border border-red-700/40 px-1.5 py-0.5 rounded-full">{t('materials.tagSeal')}</span>}
      {mat.is_item && <span className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-700/40 px-1.5 py-0.5 rounded-full">{t('materials.tagItem')}</span>}
      {mat.is_craftable && <span className="text-[10px] bg-green-900/50 text-green-300 border border-green-700/40 px-1.5 py-0.5 rounded-full">{t('materials.tagCraftable')}</span>}
    </>
  )
}

export default function MaterialsH() {
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
  const [view, setView] = useViewMode('materials')
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

  function handleAdded(mat) { setMaterials(prev => [...prev, mat].sort((a, b) => a.name.localeCompare(b.name))) }
  function handleUpdated(mat) { setMaterials(prev => prev.map(m => m.id === mat.id ? mat : m)) }
  function handleDeleted(id) { setMaterials(prev => prev.filter(m => m.id !== id)) }

  function handleExport() {
    const blob = new Blob([JSON.stringify(rawInputs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baerim-prices-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() { fileInputRef.current?.click() }

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

  const visible = sortByCategoryTag(materials.filter(mat =>
    (chapterTab === 'pvp' ? mat.is_pvp : !mat.is_pvp) &&
    matchesFilter(mat, filter) &&
    mat.name.toLowerCase().includes(search.toLowerCase())
  ))

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('materials.title') }]} />
        <PageHeader
          title={t('materials.title')}
          actions={<>
            <ViewToggle view={view} onChange={setView} />
            <PriceModeToggle mode={mode} setMode={setMode} horizontal />
            <PillButton onClick={handleSubmitToGlobal} disabled={submitting} title={t('materials.submitToGlobalTooltip')}>
              {submitting ? t('materials.submitting') : t('materials.submitToGlobal')}
            </PillButton>
            <PillButton onClick={handleExport} title={t('materials.exportTooltip')}>{t('materials.exportPrices')}</PillButton>
            <PillButton onClick={handleImportClick} title={t('materials.importTooltip')}>{t('materials.importPrices')}</PillButton>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
            {isAdmin && (
              <PillButton onClick={() => setShowAdd(true)} className="!bg-yellow-400 !text-gray-950 !border-0">{t('materials.addMaterial')}</PillButton>
            )}
          </>}
        />

        {materials.length > 0 && (
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex gap-1 bg-black/30 border border-white/10 rounded-xl p-1 self-start">
              <PillButton active={chapterTab === 'chapter1'} onClick={() => setChapterTab('chapter1')} className="!rounded-lg">Materials</PillButton>
              <PillButton active={chapterTab === 'pvp'} onClick={() => setChapterTab('pvp')} className="!rounded-lg">PVP</PillButton>
            </div>
            <input
              type="text"
              placeholder={t('materials.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <PillButton key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>{t(f.labelKey)}</PillButton>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : materials.length === 0 ? (
          <EmptyState emoji="🧪" text={t('materials.noMaterialsYet')} />
        ) : visible.length === 0 ? (
          <EmptyState emoji="🔍" text={t('materials.noMatch')} />
        ) : view === 'grid' ? (
          <GridWrap>
            {visible.map(mat => {
              const Wrapper = mat.is_craftable ? Link : 'div'
              const wrapperProps = mat.is_craftable ? { to: `/materials/${slugify(mat.name)}` } : {}
              return (
                <Wrapper key={mat.id} {...wrapperProps} className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 hover:bg-yellow-400/[0.06] hover:border-yellow-400/30 p-3 aspect-square transition-colors">
                  <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-black/30 border border-white/5">
                    {materialImages(mat).length > 0 ? <ItemImage images={materialImages(mat)} alt={mat.name} className="w-9 h-9 object-contain" /> : <span className="text-2xl">🧪</span>}
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight line-clamp-2 text-gray-200">{mat.name}</span>
                  {isAdmin && (
                    <button onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(mat) }}
                      className="absolute top-1.5 right-1.5 text-gray-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-sm">✏️</button>
                  )}
                </Wrapper>
              )
            })}
          </GridWrap>
        ) : (
          <div className="flex flex-col rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden bg-black/20">
            {visible.map(mat => {
              const Wrapper = mat.is_craftable ? Link : 'div'
              const wrapperProps = mat.is_craftable ? { to: `/materials/${slugify(mat.name)}` } : {}
              return (
                <Wrapper key={mat.id} {...wrapperProps} className="group relative flex items-center gap-4 px-5 py-3 odd:bg-white/[0.02] hover:bg-yellow-400/[0.05] transition-colors">
                  <div className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-black/30 border border-white/5">
                    {materialImages(mat).length > 0 ? <ItemImage images={materialImages(mat)} alt={mat.name} className="w-7 h-7 object-contain" /> : <span className="text-xl">🧪</span>}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-100 truncate">{mat.name}</span>
                    <TagBadges mat={mat} t={t} />
                  </div>
                  {(usedInItemIds.has(mat.id) || usedAsComponentIds.has(mat.id)) && (
                    <button onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/materials/${slugify(mat.name)}/usage`) }}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-black/30 border border-white/10 text-gray-300 hover:text-yellow-400 hover:border-yellow-400/50 transition-colors text-xs" title={t('common.seeUsage')}>
                      🔗
                    </button>
                  )}
                  {!mat.is_pvp && (
                    <div className="shrink-0 flex items-center gap-2">
                      {mat.is_craftable && mode !== 'global' && (
                        <label className="flex items-center gap-1.5 text-[0.65rem] text-gray-400 hover:text-gray-300 cursor-pointer select-none whitespace-nowrap" onClick={e => e.stopPropagation()}>
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
                    </div>
                  )}
                  {isAdmin && (
                    <button onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(mat) }}
                      className="shrink-0 text-gray-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-base">✏️</button>
                  )}
                </Wrapper>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && <AddMaterialModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      {editing && (
        <EditMaterialModal material={editing} onClose={() => setEditing(null)} onUpdated={handleUpdated} onDeleted={handleDeleted} />
      )}
    </div>
  )
}
