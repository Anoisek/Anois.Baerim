import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import ItemImage from '../components/ItemImage'
import MaterialPriceCell from '../components/MaterialPriceCell'
import EditMetinModal from '../components/EditMetinModal'
import Modal from '../components/Modal'
import PriceModeToggle from '../components/PriceModeToggle'
import ScreenshotDropzone from '../components/ScreenshotDropzone'
import { formatYang } from '../utils/formatYang'
import { itemImages } from '../utils/itemImages'
import { usePriceBook, buildRecipeMap, buildYangCostMap, fetchGlobalPrices, makeMaterialPriceFn } from '../utils/priceBook'
import { ocrImage, parseFarmSessionText, mergeFarmSessions } from '../utils/farmSessionOcr'
import { slugify, findBySlugOrId } from '../utils/slug'
import { EmptyState, PillButton } from './ui'

function loadLoot(metinId) {
  try {
    const raw = localStorage.getItem(`metin_loot_${metinId}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const BUFF_TOGGLES = [
  { key: 'vote', label: 'Vote Buff', field: 'vote_buff' },
  { key: 'casual', label: 'Casual Buff', field: 'casual_buff' },
  { key: 'glove', label: '100% Glove', field: 'glove_buff' },
  { key: 'guildDrop', label: 'Guild Drop Blessing', field: 'guild_buff' },
]
const NO_BUFFS = { vote: false, casual: false, glove: false, guildDrop: false }

export default function MetinDetailH() {
  const { metinId: metinParam } = useParams()
  const [metinId, setMetinId] = useState(null)
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [metin, setMetin] = useState(null)
  const [drops, setDrops] = useState([])
  const [materialsById, setMaterialsById] = useState({})
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [globalPrices, setGlobalPrices] = useState({})
  const [noPriceIds, setNoPriceIds] = useState(new Set())
  const [quantities, setQuantities] = useState({})
  const [groupSelection, setGroupSelection] = useState({})
  const [metinsDestroyed, setMetinsDestroyed] = useState('')
  const [metinsAutoSynced, setMetinsAutoSynced] = useState(true)
  const [duration, setDuration] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showOwnProbability, setShowOwnProbability] = useState(false)
  const [submittingProbability, setSubmittingProbability] = useState(false)
  const [showGlobalProbability, setShowGlobalProbability] = useState(false)
  const [globalStats, setGlobalStats] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(null)
  const [parsedSessions, setParsedSessions] = useState([])
  const [buffModalOpen, setBuffModalOpen] = useState(true)
  const [sessionBuffs, setSessionBuffs] = useState(NO_BUFFS)
  const [globalFilterBuffs, setGlobalFilterBuffs] = useState(NO_BUFFS)
  const { rawInputs, setPrice, mode, setMode, manualOverrides, toggleManualOverride } = usePriceBook()
  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    setBuffModalOpen(true)
    setSessionBuffs(NO_BUFFS)
  }, [metinId])

  async function reloadDrops() {
    const { data } = await db.from('metin_drops').select('material_id, alt_group, sort_order, is_guaranteed').eq('metin_id', metinId).order('sort_order')
    setDrops(data ?? [])
  }

  useEffect(() => {
    let cancelled = false
    setMetinId(null)
    db.from('metins').select('id, name').then(({ data }) => {
      if (cancelled) return
      const resolved = findBySlugOrId(data ?? [], metinParam)
      if (!resolved) setLoading(false)
      setMetinId(resolved?.id ?? null)
    })
    return () => { cancelled = true }
  }, [metinParam])

  useEffect(() => {
    if (!metinId) return
    setLoading(true)
    Promise.all([
      db.from('metins').select('*').eq('id', metinId).maybeSingle(),
      db.from('metin_drops').select('material_id, alt_group, sort_order, is_guaranteed').eq('metin_id', metinId).order('sort_order'),
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
      setNoPriceIds(new Set((materialsRes.data ?? []).filter(m => m.no_price).map(m => m.id)))

      const saved = loadLoot(metinId)
      setQuantities({})
      setGroupSelection(saved?.groupSelection ?? {})
      setMetinsDestroyed('')
      setMetinsAutoSynced(true)
      setDuration('')

      setLoading(false)
    })
  }, [metinId])

  useEffect(() => {
    if (loading) return
    localStorage.setItem(`metin_loot_${metinId}`, JSON.stringify({ groupSelection }))
  }, [metinId, loading, groupSelection])

  function handleQuantityChange(materialId, value, isGuaranteed) {
    setQuantities(prev => ({ ...prev, [materialId]: value }))
    if (isGuaranteed && metinsAutoSynced) setMetinsDestroyed(value)
  }
  function handleMetinsDestroyedChange(value) {
    setMetinsDestroyed(value)
    setMetinsAutoSynced(false)
  }
  function handleClearQuantities() { setQuantities({}) }

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts, manualOverrides, noPriceIds })

  const rows = drops.map(d => ({ ...d, material: materialsById[d.material_id] })).filter(r => r.material)
  const displayRows = []
  const seenGroups = new Set()
  for (const row of rows) {
    if (row.alt_group) {
      if (seenGroups.has(row.alt_group)) continue
      seenGroups.add(row.alt_group)
      displayRows.push({ kind: 'group', altGroup: row.alt_group, options: rows.filter(r => r.alt_group === row.alt_group) })
    } else {
      displayRows.push({ kind: 'single', material_id: row.material_id, material: row.material, is_guaranteed: row.is_guaranteed })
    }
  }

  function selectedMaterialId(display) {
    return display.kind === 'group' ? (groupSelection[display.altGroup] ?? display.options[0].material_id) : display.material_id
  }
  function isFilled(materialId) { return quantities[materialId] !== undefined && quantities[materialId] !== '' }

  const guaranteedRow = rows.find(r => r.is_guaranteed)
  const guaranteedKills = guaranteedRow ? Number(quantities[guaranteedRow.material_id]) || 0 : 0

  function isGoldBar(materialId) { return !!materialsById[materialId]?.name?.toLowerCase().startsWith('gold bar') }
  function isOptional(materialId) { return materialsById[materialId]?.name?.toLowerCase() === 'blessing scroll' }

  const goldBarDisplayRows = displayRows.filter(d => isGoldBar(selectedMaterialId(d)))
  const requiredDisplayRows = displayRows.filter(d => !isGoldBar(selectedMaterialId(d)) && !isOptional(selectedMaterialId(d)))
  const missingRequired = requiredDisplayRows.some(d => !isFilled(selectedMaterialId(d)))
  const missingGoldBar = goldBarDisplayRows.length > 0 && !goldBarDisplayRows.some(d => isFilled(selectedMaterialId(d)))
  const canCheckProbability = displayRows.length > 0 && !missingRequired && !missingGoldBar

  const totalYang = displayRows.reduce((sum, d) => {
    const matId = selectedMaterialId(d)
    return sum + priceFn(matId) * (Number(quantities[matId]) || 0)
  }, 0)
  const metinsDestroyedNum = Number(metinsDestroyed) || 0
  const sessionKillsForStats = guaranteedKills > 0 ? guaranteedKills : metinsDestroyedNum
  const [durH, durM, durS] = duration ? duration.split(':').map(Number) : [0, 0, 0]
  const minutesNum = (durH || 0) * 60 + (durM || 0) + (durS || 0) / 60
  const yangPerMinute = minutesNum > 0 ? totalYang / minutesNum : 0
  const yangPerMetin = metinsDestroyedNum > 0 ? totalYang / metinsDestroyedNum : 0

  async function persistOrder(newDisplayRows) {
    const updates = []
    newDisplayRows.forEach((d, i) => {
      if (d.kind === 'group') for (const opt of d.options) updates.push({ material_id: opt.material_id, sort_order: i })
      else updates.push({ material_id: d.material_id, sort_order: i })
    })
    setDrops(prev => prev.map(r => {
      const u = updates.find(x => x.material_id === r.material_id)
      return u ? { ...r, sort_order: u.sort_order } : r
    }).sort((a, b) => a.sort_order - b.sort_order))
    await Promise.all(updates.map(u => db.from('metin_drops').update({ sort_order: u.sort_order }).eq('metin_id', metinId).eq('material_id', u.material_id)))
  }
  function moveDisplayRow(index, delta) {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= displayRows.length) return
    const reordered = [...displayRows]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    persistOrder(reordered)
  }

  async function submitDropStats() {
    const quantitiesToSubmit = {}
    for (const d of displayRows) quantitiesToSubmit[selectedMaterialId(d)] = Number(quantities[selectedMaterialId(d)]) || 0
    setSubmittingProbability(true)
    await db.rpc('submit_metin_drop_stats', {
      p_metin_id: metinId, p_kills: sessionKillsForStats, p_quantities: quantitiesToSubmit,
      p_vote_buff: sessionBuffs.vote, p_casual_buff: sessionBuffs.casual,
      p_glove_buff: sessionBuffs.glove, p_guild_buff: sessionBuffs.guildDrop,
    })
    setSubmittingProbability(false)
  }

  useEffect(() => {
    if (loading || buffModalOpen) return
    const ready = canCheckProbability && metinsDestroyedNum > 0
    if (ready && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      submitDropStats()
    } else if (!ready) {
      autoSubmittedRef.current = false
    }
  }, [canCheckProbability, metinsDestroyedNum, loading, buffModalOpen])

  function handleCheckProbability() {
    if (metinsDestroyedNum <= 0) { alert('Enter "Metins destroyed" first.'); return }
    if (!canCheckProbability) return
    setShowOwnProbability(true)
    if (!autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      submitDropStats()
    }
  }

  async function handleShowGlobalProbability() {
    setGlobalFilterBuffs(NO_BUFFS)
    const { data } = await db.from('metin_drop_stats').select('material_id, vote_buff, casual_buff, glove_buff, guild_buff, total_quantity, total_kills').eq('metin_id', metinId)
    setGlobalStats(data ?? [])
    setShowGlobalProbability(true)
  }
  async function handleResetGlobalStats() {
    if (!confirm('Reset all global drop stats for this metin? This deletes every submission ever made — cannot be undone.')) return
    await db.from('metin_drop_stats').delete().eq('metin_id', metinId)
    setGlobalStats([])
  }
  async function handleResetMaterialStats(materialIds) {
    const ids = Array.isArray(materialIds) ? materialIds : [materialIds]
    if (!confirm(ids.length > 1 ? 'Reset global drop stats for this group only?' : 'Reset global drop stats for this material only?')) return
    await Promise.all(ids.map(id => db.from('metin_drop_stats').delete().eq('metin_id', metinId).eq('material_id', id)))
    setGlobalStats(prev => prev.filter(s => !ids.includes(s.material_id)))
  }

  const materialOptions = rows.map(r => ({ id: r.material_id, name: r.material.name }))

  async function handleScreenshotFiles(files) {
    setOcrBusy(true)
    const parsedList = []
    for (let i = 0; i < files.length; i++) {
      setOcrProgress({ fileIndex: i, fileCount: files.length, pct: 0 })
      const texts = await ocrImage(files[i], pct => setOcrProgress({ fileIndex: i, fileCount: files.length, pct }))
      for (const text of texts) parsedList.push(parseFarmSessionText(text, materialOptions))
    }
    setOcrProgress(null)
    setOcrBusy(false)
    setParsedSessions(prev => [...prev, ...parsedList])
  }

  const ocrMerged = mergeFarmSessions(parsedSessions)

  function closeImportModal() { setShowImportModal(false); setParsedSessions([]) }
  function applyOcrPreview() {
    if (ocrMerged.duration) setDuration(ocrMerged.duration)
    if (ocrMerged.kills != null) {
      setMetinsDestroyed(String(ocrMerged.kills))
      setMetinsAutoSynced(false)
    }
    setQuantities(prev => {
      const next = { ...prev }
      for (const [materialId, qty] of Object.entries(ocrMerged.matched)) next[materialId] = String(qty)
      return next
    })
    closeImportModal()
  }

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        {loading ? (
          <div className="py-20 flex justify-center"><Spinner /></div>
        ) : !metin ? (
          <>
            <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('systems.title'), to: '/systems' }, { label: t('systems.metinCalculator'), to: '/systems/metin-calculator' }]} />
            <EmptyState emoji="📭" text="Metin not found." />
          </>
        ) : (
          <>
            <Breadcrumbs items={[
              { label: t('common.home'), to: '/' },
              { label: t('systems.title'), to: '/systems' },
              { label: t('systems.metinCalculator'), to: '/systems/metin-calculator' },
              { label: metin.name },
            ]} />

            <div className="flex items-center gap-5 my-4 px-5 py-4 rounded-xl border border-white/10 bg-black/20 flex-wrap">
              <div className="w-16 h-16 shrink-0 flex items-center justify-center rounded-lg bg-black/30 border border-white/5">
                {itemImages(metin).length > 0 ? <ItemImage images={itemImages(metin)} alt={metin.name} className="w-11 h-11 object-contain drop-shadow-lg" /> : <span className="text-3xl">🪨</span>}
              </div>
              <h1 className="text-xl font-bold text-yellow-400 flex-1">{metin.name}</h1>
              <PriceModeToggle mode={mode} setMode={setMode} horizontal />
              <PillButton onClick={handleClearQuantities}>🧹 Clear quantity</PillButton>
              {isAdmin && <PillButton onClick={handleShowGlobalProbability} title="Admin-only — aggregated drop % from every user's submitted data">🔒 Global %</PillButton>}
              {isAdmin && <PillButton onClick={() => setEditing(true)}>✏️ {t('common.edit')}</PillButton>}
            </div>

            {displayRows.length === 0 ? (
              <EmptyState emoji="📭" text="No drops defined for this metin yet." />
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 min-w-0 w-full flex flex-col gap-3">
                  <button type="button" onClick={() => setShowImportModal(true)}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-yellow-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors text-center">
                    📸 Import from screenshots
                  </button>

                  <div className="flex flex-col rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden bg-black/20">
                    {displayRows.map((d, index) => {
                      const matId = selectedMaterialId(d)
                      const mat = materialsById[matId]
                      const selectedRow = d.kind === 'group' ? d.options.find(o => o.material_id === matId) : d
                      const isGuaranteed = !!selectedRow?.is_guaranteed
                      const unitPrice = priceFn(matId)
                      const qty = Number(quantities[matId]) || 0
                      const lineTotal = unitPrice * qty
                      const canOverride = mat.is_craftable && mode !== 'global'
                      return (
                        <div key={d.kind === 'group' ? d.altGroup : d.material_id} className="flex flex-wrap items-center gap-3 px-4 py-3 odd:bg-white/[0.02]">
                          {isAdmin && (
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button type="button" onClick={() => moveDisplayRow(index, -1)} disabled={index === 0}
                                className="w-5 h-5 flex items-center justify-center rounded bg-black/30 border border-white/10 text-gray-300 hover:text-yellow-400 disabled:opacity-30 text-[10px] leading-none transition-colors">▲</button>
                              <button type="button" onClick={() => moveDisplayRow(index, 1)} disabled={index === displayRows.length - 1}
                                className="w-5 h-5 flex items-center justify-center rounded bg-black/30 border border-white/10 text-gray-300 hover:text-yellow-400 disabled:opacity-30 text-[10px] leading-none transition-colors">▼</button>
                            </div>
                          )}
                          <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-black/30 border border-white/5">
                            {mat.image_url ? <img src={mat.image_url} alt={mat.name} className="w-7 h-7 object-contain" /> : <span className="text-xl">🧪</span>}
                          </div>
                          <div className="flex-1 min-w-[10rem] flex flex-col gap-1">
                            {d.kind === 'group' ? (
                              <select value={matId} onChange={e => setGroupSelection(prev => ({ ...prev, [d.altGroup]: e.target.value }))}
                                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-yellow-400">
                                {d.options.map(opt => <option key={opt.material_id} value={opt.material_id}>{materialsById[opt.material_id]?.name}</option>)}
                              </select>
                            ) : (
                              <Link to={`/materials/${slugify(mat.name)}`} className="text-sm font-semibold text-gray-100 hover:text-yellow-400 transition-colors truncate">{mat.name}</Link>
                            )}
                            {isGuaranteed && <span title="Always drops once per metin — auto-fills Metins destroyed below" className="text-[10px] text-yellow-400 border border-yellow-400/40 rounded px-1 py-0.5 self-start">1/kill</span>}
                          </div>
                          {canOverride && (
                            <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer select-none shrink-0" title={t('materials.manualPrice')}>
                              <input type="checkbox" checked={manualOverrides?.has(mat.id) ?? false} onChange={() => toggleManualOverride(mat.id)} className="accent-yellow-400 w-3.5 h-3.5" />
                            </label>
                          )}
                          <MaterialPriceCell material={mat} rawValue={rawInputs[mat.id]} computedValue={unitPrice} onPriceChange={setPrice} computed={mode === 'global' ? true : undefined} manualOverride={manualOverrides?.has(mat.id) ?? false} />
                          <input type="number" min="0" placeholder="0" value={quantities[matId] ?? ''} onChange={e => handleQuantityChange(matId, e.target.value, isGuaranteed)}
                            className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 w-16 text-center text-sm focus:outline-none focus:border-yellow-400 shrink-0" />
                          <span className="text-yellow-400 text-sm w-20 text-right font-mono shrink-0">{formatYang(lineTotal)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <p className="text-xs text-gray-500">
                    {!canCheckProbability && `Fill in a quantity for every material (0 if you got none) before checking probability${goldBarDisplayRows.length > 0 ? ' — for Gold Bars, only one type needs a value.' : '.'}`}
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
                  <div className="bg-black/30 border border-yellow-400/20 rounded-xl px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-wrap gap-4">
                      <label className="flex-1 min-w-[120px] flex flex-col gap-1">
                        <span className="text-xs text-gray-400">Metins destroyed{metinsAutoSynced && <span className="text-gray-600"> (auto)</span>}</span>
                        <input type="number" min="0" value={metinsDestroyed} onChange={e => handleMetinsDestroyedChange(e.target.value)}
                          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
                      </label>
                      <label className="flex-1 min-w-[120px] flex flex-col gap-1">
                        <span className="text-xs text-gray-400">Duration</span>
                        <input type="time" step="1" value={duration} onChange={e => setDuration(e.target.value)}
                          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
                      </label>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 font-semibold">Total yang collected</span>
                      <span className="text-2xl font-bold text-yellow-400 font-mono">{formatYang(totalYang)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-white/10 pt-3">
                      <span className="text-gray-400">Yang / minute</span><span className="text-yellow-400 font-mono">{formatYang(yangPerMinute)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Yang / metin</span><span className="text-yellow-400 font-mono">{formatYang(yangPerMetin)}</span>
                    </div>
                  </div>

                  <button type="button" onClick={handleCheckProbability} disabled={!canCheckProbability}
                    className="bg-yellow-600/20 hover:bg-yellow-600/30 disabled:hover:bg-yellow-600/20 border border-yellow-500/40 text-yellow-300 hover:text-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                    🎲 Check drop probability
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!loading && metin && buffModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1c1712] border border-white/10 rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 text-center shadow-xl shadow-black/40">
            <img src="/switch_mokoko.png" alt="" className="w-24 h-24 object-contain" />
            <h2 className="text-xl font-bold text-yellow-400">Before you start</h2>
            <p className="text-sm text-gray-300 leading-relaxed">Are you using any drop-rate buffs on this run?</p>
            <div className="w-full flex flex-col gap-2 text-left">
              {BUFF_TOGGLES.map(b => (
                <label key={b.key} className="flex items-center gap-2 text-sm text-gray-200 bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 cursor-pointer hover:border-yellow-400/50 transition-colors">
                  <input type="checkbox" checked={sessionBuffs[b.key]} onChange={e => setSessionBuffs(prev => ({ ...prev, [b.key]: e.target.checked }))} className="accent-yellow-400 w-4 h-4" />
                  {b.label}
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setBuffModalOpen(false)} className="mt-2 w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold rounded-xl px-8 py-2.5 transition-colors">Start</button>
          </div>
        </div>
      )}

      {editing && metin && (
        <EditMetinModal metin={metin} onClose={() => setEditing(false)} onUpdated={updated => { setMetin(updated); reloadDrops() }} onDeleted={() => setMetin(null)} />
      )}

      {showOwnProbability && (
        <Modal title="Drop probability (this session)" onClose={() => setShowOwnProbability(false)}>
          {submittingProbability && <p className="text-xs text-gray-500 text-center mb-3">Submitting to the global stats…</p>}
          <p className="text-xs text-gray-500 text-center mb-3">
            Based on {sessionKillsForStats} metins destroyed this session
            {guaranteedKills > 0 && <span className="text-gray-600"> (from {guaranteedRow.material.name} count, not the typed field)</span>}.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {displayRows.map(d => {
              const matId = selectedMaterialId(d)
              const mat = materialsById[matId]
              const pct = (Number(quantities[matId]) || 0) / sessionKillsForStats * 100
              return (
                <div key={matId} className="flex flex-col items-center gap-1.5 p-3 bg-black/20 border border-white/10 rounded-xl">
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center">{mat.image_url ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain" /> : <span className="text-2xl">🧪</span>}</div>
                  <span className="text-xs text-gray-300 text-center leading-tight">{mat.name}</span>
                  <span className="text-yellow-400 text-sm font-bold font-mono">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {showGlobalProbability && (
        <Modal title="Global drop probability" onClose={() => setShowGlobalProbability(false)}>
          <p className="text-xs text-gray-500 text-center mb-3">
            Aggregated from every user's submitted data. Check the buffs you want to filter by — percentages below update live to that exact combination.
          </p>
          <div className="flex items-center justify-center gap-1.5 mb-3 flex-wrap">
            {BUFF_TOGGLES.map(b => (
              <label key={b.key} className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 cursor-pointer border transition-colors ${
                globalFilterBuffs[b.key] ? 'bg-yellow-400/10 border-yellow-400/60 text-yellow-300' : 'bg-black/20 border-white/10 text-gray-300 hover:border-white/20'
              }`}>
                <input type="checkbox" checked={globalFilterBuffs[b.key]} onChange={e => setGlobalFilterBuffs(prev => ({ ...prev, [b.key]: e.target.checked }))} className="accent-yellow-400 w-3.5 h-3.5" />
                {b.label}
              </label>
            ))}
          </div>
          {globalStats !== null && globalStats.length > 0 && (
            <div className="flex items-center justify-center mb-3">
              <button type="button" onClick={handleResetGlobalStats} title="Delete every submission ever made for this metin"
                className="text-[11px] text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700 rounded-full px-2 py-0.5 transition-colors shrink-0">🗑 Reset all</button>
            </div>
          )}
          {globalStats === null ? <Spinner /> : displayRows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No drops defined for this metin yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {displayRows.map(d => {
                const members = d.kind === 'group' ? d.options : [{ material_id: d.material_id, material: d.material }]
                const memberIds = members.map(m => m.material_id)
                const rowKey = d.kind === 'group' ? d.altGroup : d.material_id
                const stats = globalStats.filter(s => memberIds.includes(s.material_id) && BUFF_TOGGLES.every(b => !!s[b.field] === globalFilterBuffs[b.key]))
                const totalQuantity = stats.reduce((sum, s) => sum + s.total_quantity, 0)
                const totalKills = stats.reduce((sum, s) => sum + s.total_kills, 0)
                const pct = totalKills > 0 ? totalQuantity / totalKills * 100 : null
                return (
                  <div key={rowKey} className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-xl px-3 py-2">
                    <div className="flex -space-x-1.5 shrink-0">
                      {members.map(m => (
                        <div key={m.material_id} className="w-8 h-8 rounded-full bg-[#14110d] border border-white/10 flex items-center justify-center overflow-hidden">
                          {m.material.image_url ? <img src={m.material.image_url} alt={m.material.name} className="w-full h-full object-contain" /> : <span className="text-base">🧪</span>}
                        </div>
                      ))}
                    </div>
                    {d.kind !== 'group' && <span className="flex-1 text-sm text-gray-300 leading-tight">{d.material.name}</span>}
                    {d.kind === 'group' && <span className="flex-1" />}
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-yellow-400 font-bold font-mono text-sm">{pct === null ? '—' : pct.toFixed(1) + '%'}</span>
                      {pct !== null && <span className="text-gray-600 text-[10px]">n={totalKills}</span>}
                    </div>
                    <button type="button" onClick={() => handleResetMaterialStats(memberIds)} title="Reset stats for this material only (every buff combination)" className="text-gray-600 hover:text-red-400 text-xs leading-none transition-colors shrink-0">🗑</button>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {showImportModal && (
        <Modal title="Import from screenshots" onClose={closeImportModal}>
          <p className="text-xs text-gray-500 text-center mb-3">
            Drop as many "Farm Session" screenshots as you have — scrolled snapshots of the same session merge automatically. Process a batch, then keep dropping more before applying.
          </p>
          <ScreenshotDropzone onFiles={handleScreenshotFiles} disabled={ocrBusy} />
          {ocrBusy && ocrProgress && (
            <p className="text-xs text-gray-500 text-center mt-2">Reading screenshot {ocrProgress.fileIndex + 1} / {ocrProgress.fileCount}… {Math.round(ocrProgress.pct * 100)}%</p>
          )}
          {parsedSessions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-gray-500 text-center mb-3">From {parsedSessions.length} screenshot{parsedSessions.length > 1 ? 's' : ''} so far — review before applying.</p>
              <div className="flex justify-center gap-6 mb-4 text-sm">
                <span className="text-gray-300">Duration: <span className="text-yellow-400 font-mono">{ocrMerged.duration ?? '—'}</span></span>
                <span className="text-gray-300">Metins destroyed: <span className="text-yellow-400 font-mono">{ocrMerged.kills ?? '—'}</span></span>
              </div>
              {Object.keys(ocrMerged.matched).length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                  {Object.entries(ocrMerged.matched).map(([materialId, qty]) => {
                    const mat = materialsById[materialId]
                    if (!mat) return null
                    return (
                      <div key={materialId} className="flex flex-col items-center gap-1.5 p-3 bg-black/20 border border-white/10 rounded-xl">
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center">{mat.image_url ? <img src={mat.image_url} alt={mat.name} className="w-full h-full object-contain" /> : <span className="text-xl">🧪</span>}</div>
                        <span className="text-xs text-gray-300 text-center leading-tight">{mat.name}</span>
                        <span className="text-yellow-400 text-sm font-bold font-mono">×{qty}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {ocrMerged.matchedUnknownQty.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1.5">Recognized these drops but couldn't read a quantity — fill them in manually:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ocrMerged.matchedUnknownQty.map(materialId => (
                      <span key={materialId} className="text-[11px] text-gray-400 bg-black/20 border border-white/10 rounded px-2 py-1">{materialsById[materialId]?.name ?? materialId}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={closeImportModal} className="flex-1 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-lg py-2 transition-colors">
              {parsedSessions.length > 0 ? 'Discard' : 'Close'}
            </button>
            <button type="button" onClick={applyOcrPreview} disabled={parsedSessions.length === 0}
              className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-950 text-sm font-bold rounded-lg py-2 transition-colors">
              Apply to calculator
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
