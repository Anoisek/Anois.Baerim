import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import ImageUpload from '../components/ImageUpload'
import IconDbPicker from '../components/IconDbPicker'
import AlchemyPriceCell from '../components/AlchemyPriceCell'
import EditAlchemyStoneModal from '../components/EditAlchemyStoneModal'
import { deleteImages } from '../utils/imageStorage'
import { formatYang, parseYang } from '../utils/formatYang'
import { useAlchemyPriceBook, fetchAlchemyGlobalPrices, submitAlchemyPriceToGlobal, resolvePrice } from '../utils/alchemyPriceBook'

const GRADES = [
  { key: 'matt', label: 'Matt' },
  { key: 'clear', label: 'Clear' },
  { key: 'flawless', label: 'Flawless' },
  { key: 'brilliant', label: 'Brilliant' },
  { key: 'excellent', label: 'Excellent' },
]
const DEFAULT_AVG_MATT_PER_6000 = 11.5
const CORS_PER_BATCH = 6000

function stoneGradeKey(stoneId, gradeKey) {
  return `${stoneId}:${gradeKey}`
}

// formatYang's size tiers (k/kk/kkk) assume a non-negative value, so a loss would
// otherwise render as a raw "-30000000 yang" instead of "-30kk yang".
function formatSignedYang(value) {
  return value < 0 ? `-${formatYang(-value)}` : formatYang(value)
}

// 100% mode: 2 stones always combine into 1 of the next grade.
// Avg/50% mode: each attempt has a 50% chance and consumes the 2 stones regardless
// of outcome, so the expected number needed is 2 / 0.5 = 4 per step.
function stonesPerStep(successMode) {
  return successMode === '100' ? 2 : 4
}

function mattNeededForGrade(gradeIndex, successMode) {
  return Math.pow(stonesPerStep(successMode), gradeIndex)
}

export default function Alchemy() {
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

  function priceFor(key) {
    return resolvePrice(key, priceBook.mode, priceBook.rawInputs, globalPrices)
  }

  function handlePriceChange(key, raw) {
    priceBook.setPrice(key, raw)
  }

  async function handlePriceBlur(key, raw) {
    const { accepted } = await submitAlchemyPriceToGlobal(key, raw)
    if (accepted) {
      const price = parseYang(raw)
      setGlobalPrices(prev => ({ ...prev, [key]: price }))
    }
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

  function handleStoneSaved(updated) {
    setStones(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

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

  function manualCount(key) {
    return parseInt(manualCounts[key], 10) || 0
  }
  function setManualCount(key, raw) {
    setManualCounts(prev => ({ ...prev, [key]: raw }))
  }
  const manualTotal = stones.reduce((sum, stone) => {
    return sum + GRADES.reduce((s2, g) => {
      const key = stoneGradeKey(stone.id, g.key)
      return s2 + manualCount(key) * priceFor(key)
    }, 0)
  }, 0)

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.alchemy') },
          ]} />
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{t('systems.alchemy')}</h1>
            {maintenance && isAdmin && (
              <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
                🚧 {t('common.inProgress')}
              </span>
            )}
          </div>

          {loading ? <Spinner /> : blocked ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🚧</span>
              <p className="text-sm">{t('systems.blockedMessage')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 flex items-center justify-center bg-gray-900/80 border border-gray-700 rounded-xl shrink-0">
                    {corImageUrl
                      ? <img src={corImageUrl} alt="Cor Draconis" className="w-full h-full object-contain" />
                      : <span className="text-2xl">🔴</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-200">Cor Draconis</span>
                    <div className="w-32">
                      <AlchemyPriceCell
                        mode={priceBook.mode}
                        rawValue={priceBook.rawInputs['cor']}
                        resolvedValue={corPrice}
                        onChange={raw => handlePriceChange('cor', raw)}
                        onBlurSubmit={raw => handlePriceBlur('cor', raw)}
                      />
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col gap-1">
                      {corImageUrl && (
                        <button type="button" onClick={handleRemoveCorImage} className="text-xs text-red-400 hover:text-red-300 text-left">
                          Remove image
                        </button>
                      )}
                      <div className="flex gap-1">
                        <ImageUpload onUploaded={handleCorImageChosen} />
                        <IconDbPicker onUploaded={handleCorImageChosen} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => priceBook.setMode('own')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${priceBook.mode === 'own' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                  >
                    My Own Prices
                  </button>
                  <button
                    type="button"
                    onClick={() => priceBook.setMode('global')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${priceBook.mode === 'global' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                  >
                    Global Prices
                  </button>
                </div>
              </div>

              <div className="border border-gray-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPricesExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-900/60 hover:bg-gray-900 text-sm font-semibold text-gray-200 transition-colors"
                >
                  Stone prices
                  <span className="text-gray-500 text-xs">{pricesExpanded ? '▲ hide' : '▼ show'}</span>
                </button>
                {pricesExpanded && (
                  <div className="p-4 bg-gray-950/40 overflow-x-auto">
                    <div className="grid gap-x-2 gap-y-2 min-w-[36rem] grid-cols-[9rem_repeat(5,1fr)]">
                      <div />
                      {GRADES.map(g => (
                        <div key={g.key} className="text-xs text-center font-semibold text-gray-400">{g.label}</div>
                      ))}
                      {stones.map(stone => (
                        <Fragment key={stone.id}>
                          <div className="group relative flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 flex items-center justify-center shrink-0">
                              {stone.image_url
                                ? <img src={stone.image_url} alt="" className="w-full h-full object-contain" />
                                : <span className="text-lg">💎</span>}
                            </div>
                            <span className="text-sm text-gray-200 truncate">{stone.name}</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setEditingStone(stone)}
                                className="text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-xs shrink-0"
                                title="Edit"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                          {GRADES.map(g => {
                            const key = stoneGradeKey(stone.id, g.key)
                            return (
                              <AlchemyPriceCell
                                key={key}
                                mode={priceBook.mode}
                                rawValue={priceBook.rawInputs[key]}
                                resolvedValue={priceFor(key)}
                                onChange={raw => handlePriceChange(key, raw)}
                                onBlurSubmit={raw => handlePriceBlur(key, raw)}
                              />
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3">
                <label className="text-sm text-gray-300 font-semibold">How many Cor Draconis do you have?</label>
                <input
                  type="number"
                  min="0"
                  value={numCors}
                  onChange={e => setNumCors(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 w-32 text-sm focus:outline-none focus:border-yellow-400"
                />
                <span className="text-sm text-gray-400">
                  Cost: <span className="text-yellow-400 font-bold">{formatYang(corsCost)}</span>
                </span>
              </div>

              <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-xl p-1 self-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('average')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'average' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  Average Opening
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'manual' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  Manual Entry
                </button>
              </div>

              {activeTab === 'average' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 text-center">Target grade:</span>
                      <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-xl p-1">
                        {GRADES.map(g => (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => setTargetGrade(g.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${targetGrade === g.key ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 text-center">Purity upgrade chance:</span>
                      <div className="flex gap-1 bg-gray-800 border border-gray-600 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => setSuccessMode('100')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${successMode === '100' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                          100% success
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuccessMode('avg')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${successMode === 'avg' ? 'bg-yellow-400 text-gray-950' : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                          Avg (50% success)
                        </button>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 text-center">Avg matt per {CORS_PER_BATCH.toLocaleString()} cors:</span>
                        <input
                          type="number"
                          step="any"
                          defaultValue={avgMattPer6000}
                          onBlur={e => handleAvgMattBlur(e.target.value)}
                          className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 w-full text-white text-xs focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                    )}
                  </div>

                  {numCorsValue === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">Enter how many Cor Draconis you have above to see an estimate.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {averageResults.map(({ stone, targetStones, value }) => (
                          <div key={stone.id} className="bg-gray-900/80 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
                            <div className="w-9 h-9 flex items-center justify-center shrink-0">
                              {stone.image_url
                                ? <img src={stone.image_url} alt="" className="w-full h-full object-contain" />
                                : <span className="text-xl">💎</span>}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm text-gray-200 truncate">{stone.name}</span>
                              <span className="text-xs text-gray-400">~{targetStones.toFixed(2)} {GRADES[gradeIndex].label}</span>
                              <span className="text-sm font-bold text-yellow-400">{formatYang(value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-1 bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 text-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Estimated stone value</span><span className="font-bold text-yellow-400">{formatYang(totalAverageValue)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Cost of cors</span><span className="font-bold text-gray-200">{formatYang(corsCost)}</span></div>
                        <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
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
                      {GRADES.map(g => (
                        <div key={g.key} className="text-xs text-center font-semibold text-gray-400">{g.label}</div>
                      ))}
                      {stones.map(stone => (
                        <Fragment key={stone.id}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 flex items-center justify-center shrink-0">
                              {stone.image_url
                                ? <img src={stone.image_url} alt="" className="w-full h-full object-contain" />
                                : <span className="text-lg">💎</span>}
                            </div>
                            <span className="text-sm text-gray-200 truncate">{stone.name}</span>
                          </div>
                          {GRADES.map(g => {
                            const key = stoneGradeKey(stone.id, g.key)
                            return (
                              <input
                                key={key}
                                type="number"
                                min="0"
                                placeholder="0"
                                value={manualCounts[key] ?? ''}
                                onChange={e => setManualCount(key, e.target.value)}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 w-full text-right text-xs focus:outline-none focus:border-yellow-400 transition-colors"
                              />
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-3 text-sm">
                    <span className="text-gray-300 font-semibold">Total value</span>
                    <span className="font-bold text-yellow-400">{formatYang(manualTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editingStone && (
        <EditAlchemyStoneModal
          stone={editingStone}
          onClose={() => setEditingStone(null)}
          onSaved={handleStoneSaved}
        />
      )}
    </div>
  )
}
