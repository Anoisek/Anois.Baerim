import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import ImageUpload from '../components/ImageUpload'
import IconDbPicker from '../components/IconDbPicker'
import AlchemyPriceCell from '../components/AlchemyPriceCell'
import EditAlchemyStoneModal from '../components/EditAlchemyStoneModal'
import { deleteImages } from '../utils/imageStorage'
import { formatYang, parseYang } from '../utils/formatYang'
import { useAlchemyPriceBook, fetchAlchemyGlobalPrices, submitAlchemyPriceToGlobal, resolvePrice } from '../utils/alchemyPriceBook'
import { EmptyState, PillButton } from './ui'

const GRADES = [
  { key: 'matt', label: 'Matt' },
  { key: 'clear', label: 'Clear' },
  { key: 'flawless', label: 'Flawless' },
  { key: 'brilliant', label: 'Brilliant' },
  { key: 'excellent', label: 'Excellent' },
]
const DEFAULT_AVG_MATT_PER_6000 = 11.5
const CORS_PER_BATCH = 6000

function stoneGradeKey(stoneId, gradeKey) { return `${stoneId}:${gradeKey}` }
function formatSignedYang(value) { return value < 0 ? `-${formatYang(-value)}` : formatYang(value) }
function stonesPerStep(successMode) { return successMode === '100' ? 2 : 4 }
function mattNeededForGrade(gradeIndex, successMode) { return Math.pow(stonesPerStep(successMode), gradeIndex) }

export default function AlchemyH() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [maintenance, setMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stones, setStones] = useState([])
  const [globalPrices, setGlobalPrices] = useState({})
  const [corImageUrl, setCorImageUrl] = useState('')
  const [avgMattPer6000, setAvgMattPer6000] = useState(String(DEFAULT_AVG_MATT_PER_6000))
  const [editingStone, setEditingStone] = useState(null)
  const [pricesExpanded, setPricesExpanded] = useState(false)
  const [numCors, setNumCors] = useState('')
  const [activeTab, setActiveTab] = useState('average')
  const [targetGrade, setTargetGrade] = useState('matt')
  const [successMode, setSuccessMode] = useState('100')
  const [manualCounts, setManualCounts] = useState({})

  const priceBook = useAlchemyPriceBook()

  useEffect(() => {
    Promise.all([
      db.from('settings').select('value').eq('key', 'system_alchemy_maintenance').maybeSingle(),
      db.from('settings').select('value').eq('key', 'alchemy_cor_image_url').maybeSingle(),
      db.from('settings').select('value').eq('key', 'alchemy_avg_matt_per_6000').maybeSingle(),
      db.from('alchemy_stones').select('*').order('sort_order'),
      fetchAlchemyGlobalPrices(),
    ]).then(([maintRes, corImgRes, avgRes, stonesRes, globalPricesMap]) => {
      setMaintenance(maintRes.data?.value === 'true')
      setCorImageUrl(corImgRes.data?.value || '')
      setAvgMattPer6000(avgRes.data?.value || String(DEFAULT_AVG_MATT_PER_6000))
      setStones(stonesRes.data ?? [])
      setGlobalPrices(globalPricesMap)
      setLoading(false)
    })
  }, [])

  const blocked = maintenance && !isAdmin
  function priceFor(key) { return resolvePrice(key, priceBook.mode, priceBook.rawInputs, globalPrices) }
  function handlePriceChange(key, raw) { priceBook.setPrice(key, raw) }
  async function handlePriceBlur(key, raw) {
    const { accepted } = await submitAlchemyPriceToGlobal(key, raw)
    if (accepted) setGlobalPrices(prev => ({ ...prev, [key]: parseYang(raw) }))
  }
  async function handleCorImageChosen(url) {
    if (corImageUrl) await deleteImages(corImageUrl)
    setCorImageUrl(url)
    await db.from('settings').upsert({ key: 'alchemy_cor_image_url', value: url })
  }
  async function handleRemoveCorImage() {
    if (corImageUrl) await deleteImages(corImageUrl)
    setCorImageUrl('')
    await db.from('settings').upsert({ key: 'alchemy_cor_image_url', value: '' })
  }
  async function handleAvgMattBlur(raw) {
    const value = parseFloat(raw)
    const clean = Number.isFinite(value) && value > 0 ? String(value) : String(DEFAULT_AVG_MATT_PER_6000)
    setAvgMattPer6000(clean)
    await db.from('settings').upsert({ key: 'alchemy_avg_matt_per_6000', value: clean })
  }
  function handleStoneSaved(updated) { setStones(prev => prev.map(s => s.id === updated.id ? updated : s)) }

  const corPrice = priceFor('cor')
  const numCorsValue = parseInt(numCors, 10) || 0
  const corsCost = numCorsValue * corPrice
  const gradeIndex = GRADES.findIndex(g => g.key === targetGrade)
  const mattNeeded = mattNeededForGrade(gradeIndex, successMode)
  const avgMattRate = parseFloat(avgMattPer6000) || DEFAULT_AVG_MATT_PER_6000

  const averageResults = stones.map(stone => {
    const avgMattForStone = numCorsValue * (avgMattRate / CORS_PER_BATCH)
    const targetStones = mattNeeded > 0 ? avgMattForStone / mattNeeded : 0
    const price = priceFor(stoneGradeKey(stone.id, targetGrade))
    return { stone, avgMattForStone, targetStones, value: targetStones * price }
  })
  const totalAverageValue = averageResults.reduce((sum, r) => sum + r.value, 0)
  const averageProfit = totalAverageValue - corsCost

  function manualCount(key) { return parseInt(manualCounts[key], 10) || 0 }
  function setManualCount(key, raw) { setManualCounts(prev => ({ ...prev, [key]: raw })) }
  const manualTotal = stones.reduce((sum, stone) => sum + GRADES.reduce((s2, g) => {
    const key = stoneGradeKey(stone.id, g.key)
    return s2 + manualCount(key) * priceFor(key)
  }, 0), 0)

  return (
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('systems.title'), to: '/systems' }, { label: t('systems.alchemy') }]} />
        <div className="flex items-center gap-2 mb-5">
          <h1 className="text-xl font-bold text-gray-100">{t('systems.alchemy')}</h1>
          {maintenance && isAdmin && <span className="text-[11px] font-bold text-yellow-400 bg-black/40 border border-yellow-400/30 px-2 py-1 rounded-full">🚧 {t('common.inProgress')}</span>}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : blocked ? (
          <EmptyState emoji="🚧" text={t('systems.blockedMessage')} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 flex items-center justify-center bg-black/20 border border-white/10 rounded-xl shrink-0">
                  {corImageUrl ? <img src={corImageUrl} alt="Cor Draconis" className="w-full h-full object-contain" /> : <span className="text-2xl">🔴</span>}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-200">Cor Draconis</span>
                  <div className="w-32">
                    <AlchemyPriceCell mode={priceBook.mode} rawValue={priceBook.rawInputs['cor']} resolvedValue={corPrice} onChange={raw => handlePriceChange('cor', raw)} onBlurSubmit={raw => handlePriceBlur('cor', raw)} />
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    {corImageUrl && <button type="button" onClick={handleRemoveCorImage} className="text-xs text-red-400 hover:text-red-300 text-left">Remove image</button>}
                    <div className="flex gap-1">
                      <ImageUpload onUploaded={handleCorImageChosen} />
                      <IconDbPicker onUploaded={handleCorImageChosen} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-1 bg-black/30 border border-white/10 rounded-xl p-1 shrink-0">
                <PillButton active={priceBook.mode === 'own'} onClick={() => priceBook.setMode('own')} className="!rounded-lg">My Own Prices</PillButton>
                <PillButton active={priceBook.mode === 'global'} onClick={() => priceBook.setMode('global')} className="!rounded-lg">Global Prices</PillButton>
              </div>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setPricesExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-black/20 hover:bg-black/30 text-sm font-semibold text-gray-200 transition-colors">
                Alchemy prices
                <span className="text-gray-500 text-xs">{pricesExpanded ? '▲ hide' : '▼ show'}</span>
              </button>
              {pricesExpanded && (
                <div className="p-4 bg-black/10 overflow-x-auto">
                  <div className="grid gap-x-2 gap-y-2 min-w-[36rem] grid-cols-[9rem_repeat(5,1fr)]">
                    <div />
                    {GRADES.map(g => <div key={g.key} className="text-xs text-center font-semibold text-gray-400">{g.label}</div>)}
                    {stones.map(stone => (
                      <Fragment key={stone.id}>
                        <div className="group relative flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {stone.image_url ? <img src={stone.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-lg">💎</span>}
                          </div>
                          <span className="text-sm text-gray-200 truncate">{stone.name}</span>
                          {isAdmin && (
                            <button type="button" onClick={() => setEditingStone(stone)} className="text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-xs shrink-0" title="Edit">✏️</button>
                          )}
                        </div>
                        {GRADES.map(g => {
                          const key = stoneGradeKey(stone.id, g.key)
                          return <AlchemyPriceCell key={key} mode={priceBook.mode} rawValue={priceBook.rawInputs[key]} resolvedValue={priceFor(key)} onChange={raw => handlePriceChange(key, raw)} onBlurSubmit={raw => handlePriceBlur(key, raw)} />
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap bg-black/20 border border-white/10 rounded-xl px-4 py-3">
              <label className="text-sm text-gray-300 font-semibold">How many Cor Draconis do you have?</label>
              <input type="number" min="0" value={numCors} onChange={e => setNumCors(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 w-32 text-sm focus:outline-none focus:border-yellow-400" />
              <span className="text-sm text-gray-400">Cost: <span className="text-yellow-400 font-bold">{formatYang(corsCost)}</span></span>
            </div>

            <div className="flex gap-1 bg-black/30 border border-white/10 rounded-xl p-1 self-start">
              <PillButton active={activeTab === 'average'} onClick={() => setActiveTab('average')} className="!rounded-lg !px-4 !py-2">Average Opening</PillButton>
              <PillButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')} className="!rounded-lg !px-4 !py-2">Manual Entry</PillButton>
            </div>

            {activeTab === 'average' ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-stretch gap-3 flex-wrap">
                  <div className="flex flex-col items-center justify-center gap-1.5 bg-black/20 border border-white/10 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-200 font-semibold text-center">Target grade:</span>
                    <div className="flex gap-1 bg-black/30 border border-white/10 rounded-xl p-1">
                      {GRADES.map(g => <PillButton key={g.key} active={targetGrade === g.key} onClick={() => setTargetGrade(g.key)} className="!rounded-lg">{g.label}</PillButton>)}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1.5 bg-black/20 border border-white/10 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-200 font-semibold text-center">Purity upgrade chance:</span>
                    <div className="flex gap-1 bg-black/30 border border-white/10 rounded-xl p-1">
                      <PillButton active={successMode === '100'} onClick={() => setSuccessMode('100')} className="!rounded-lg">100% success</PillButton>
                      <PillButton active={successMode === 'avg'} onClick={() => setSuccessMode('avg')} className="!rounded-lg">Avg (50% success)</PillButton>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col items-center justify-center gap-1.5 bg-black/20 border border-white/10 rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-200 font-semibold text-center">Avg matt per {CORS_PER_BATCH.toLocaleString()} cors:</span>
                      <input type="number" step="any" defaultValue={avgMattPer6000} onBlur={e => handleAvgMattBlur(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 w-24 text-white text-xs text-center focus:outline-none focus:border-yellow-400" />
                    </div>
                  )}
                </div>

                {numCorsValue === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">Enter how many Cor Draconis you have above to see an estimate.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {averageResults.map(({ stone, targetStones, value }) => (
                        <div key={stone.id} className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                          <div className="w-9 h-9 flex items-center justify-center shrink-0">
                            {stone.image_url ? <img src={stone.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-xl">💎</span>}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm text-gray-200 truncate">{stone.name}</span>
                            <span className="text-xs text-gray-400">~{targetStones.toFixed(2)} {GRADES[gradeIndex].label}</span>
                            <span className="text-sm font-bold text-yellow-400">{formatYang(value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">Estimated stone value</span><span className="font-bold text-yellow-400">{formatYang(totalAverageValue)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Cost of cors</span><span className="font-bold text-gray-200">{formatYang(corsCost)}</span></div>
                      <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                        <span className="text-gray-300 font-semibold">Profit</span>
                        <span className={`font-bold ${averageProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatSignedYang(averageProfit)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-gray-500">Enter how many of each stone/grade you actually have — the value is calculated from the prices above.</p>
                <div className="overflow-x-auto">
                  <div className="grid gap-x-2 gap-y-2 min-w-[36rem] grid-cols-[9rem_repeat(5,1fr)]">
                    <div />
                    {GRADES.map(g => <div key={g.key} className="text-xs text-center font-semibold text-gray-400">{g.label}</div>)}
                    {stones.map(stone => (
                      <Fragment key={stone.id}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {stone.image_url ? <img src={stone.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-lg">💎</span>}
                          </div>
                          <span className="text-sm text-gray-200 truncate">{stone.name}</span>
                        </div>
                        {GRADES.map(g => {
                          const key = stoneGradeKey(stone.id, g.key)
                          return (
                            <input key={key} type="number" min="0" placeholder="0" value={manualCounts[key] ?? ''} onChange={e => setManualCount(key, e.target.value)}
                              className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 w-full text-right text-xs focus:outline-none focus:border-yellow-400 transition-colors" />
                          )
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm">
                  <span className="text-gray-300 font-semibold">Total value</span>
                  <span className="font-bold text-yellow-400">{formatYang(manualTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editingStone && <EditAlchemyStoneModal stone={editingStone} onClose={() => setEditingStone(null)} onSaved={handleStoneSaved} />}
    </div>
  )
}
