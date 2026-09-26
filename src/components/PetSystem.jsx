import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import { formatYang } from '../utils/formatYang'
import { slugify } from '../utils/slug'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap, fetchGlobalPrices, makeMaterialPriceFn, FIXED_MATERIAL_PRICES,
} from '../utils/priceBook'
import {
  PET_TABS, PET_MAT, EVOLUTIONS, TYPE_MIN, TYPE_MAX, TYPE_MAX_PITY, TYPE_STEPS,
  POTION_SUCCESSES_PER_SIZE, POTION_DEFAULT_FACTOR, POTION_SIZES, POTION_GROUPS, potionKey,
  SKILL_SLOTS, MIN_BOOKS, PET_SKILLS, bookKey, UNLOCKER_KEY, PET_PRESETS,
  PET_CHOICES_KEY, defaultPetChoices, loadPetChoices, booksOf, potionsOf, typePityOf, petPartCost,
} from '../utils/petSystem'
import MatRow from './MatRow'
import Modal from './Modal'
import MaterialPriceCell from './MaterialPriceCell'
import IconDbPicker from './IconDbPicker'
import PasteImageButton from './PasteImageButton'
import PriceModeToggle from './PriceModeToggle'
import StickyTotalBar, { useStickyTotal } from './StickyTotalBar'
import Spinner from './Spinner'
import { PityStepper } from '../horizontal/ui'

const ICON_EDIT_BTN = 'text-[10px] leading-none px-1.5 py-0.5 rounded border border-dashed border-yellow-400/50 text-yellow-300 hover:bg-yellow-400/10 disabled:opacity-50'

export default function PetSystem({ horizontal = false }) {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = PET_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : PET_TABS[0]
  const setTab = key => setSearchParams({ tab: key }, { replace: true })

  const [loading, setLoading] = useState(true)
  const [materialsById, setMaterialsById] = useState({})
  const [recipes, setRecipes] = useState({})
  const [craftYangCosts, setCraftYangCosts] = useState({})
  const [globalPrices, setGlobalPrices] = useState({})
  const [noPriceIds, setNoPriceIds] = useState(new Set())
  const { rawInputs, setPrice, mode, setMode, manualOverrides, toggleManualOverride } = usePriceBook()
  const [stickyTotal, setStickyTotal] = useStickyTotal()
  const [choices, setChoices] = useState(loadPetChoices)
  const [editIcons, setEditIcons] = useState(false)
  const [priceModal, setPriceModal] = useState(null) // { title, keys } — "set prices" modal
  const [skillPickerSlot, setSkillPickerSlot] = useState(null)

  useEffect(() => {
    Promise.all([
      db.from('materials').select('id, name, image_url, is_craftable, craft_yang_cost, no_price'),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      fetchGlobalPrices(),
    ]).then(([matsRes, recipeRes, globalMap]) => {
      const mats = matsRes.data ?? []
      setMaterialsById(Object.fromEntries(mats.map(m => [m.id, m])))
      setRecipes(buildRecipeMap(recipeRes.data))
      setCraftYangCosts(buildYangCostMap(mats))
      setGlobalPrices(globalMap)
      setNoPriceIds(new Set(mats.filter(m => m.no_price).map(m => m.id)))
      setLoading(false)
    })
  }, [])

  function updateChoices(fn) {
    setChoices(prev => {
      const next = fn(prev)
      try { localStorage.setItem(PET_CHOICES_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  // Clear / presets only touch this pet's choices — typed prices live in the price book.
  function applyPreset(preset) {
    updateChoices(prev => {
      if (!preset) return defaultPetChoices()
      const p = PET_PRESETS[preset]
      return {
        ...prev,
        potions: { ...prev.potions, groups: Object.fromEntries(POTION_GROUPS.map(g => [g.key, p.potions.includes(g.key)])) },
        skills: { ...prev.skills, slots: [...p.skills] },
      }
    })
  }

  async function changeIcon(key, url) {
    const id = PET_MAT[key]
    const prev = materialsById[id]?.image_url
    setMaterialsById(m => ({ ...m, [id]: { ...m[id], image_url: url } }))
    const { error } = await db.from('materials').update({ image_url: url }).eq('id', id)
    if (error) {
      setMaterialsById(m => ({ ...m, [id]: { ...m[id], image_url: prev } }))
      alert('Error: ' + error.message)
    }
  }

  const priceFn = makeMaterialPriceFn(mode, { rawInputs, globalPrices, recipes, yangCosts: craftYangCosts, manualOverrides, noPriceIds })
  const costOf = part => {
    const { mats, yang } = petPartCost(part, choices)
    return { mats, yang, total: yang + mats.reduce((sum, [id, qty]) => sum + priceFn(id) * qty, 0) }
  }
  const { mats, yang, total } = costOf(tab)

  const panel = horizontal ? 'bg-black/30 border border-white/10 rounded-xl' : 'bg-gray-900 border border-gray-700 rounded-2xl'
  const divider = horizontal ? 'divide-white/10' : 'divide-gray-700'
  const inputCls = horizontal
    ? 'bg-black/25 border border-white/10 rounded-lg px-2 py-1 w-20 text-right text-sm text-white focus:outline-none focus:border-yellow-400'
    : 'bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 w-20 text-right text-sm text-white focus:outline-none focus:border-yellow-400'
  const smallBtn = horizontal
    ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors'
    : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors'

  function MatIcon({ matKey, size = 'w-8 h-8', editable = false }) {
    const m = materialsById[PET_MAT[matKey]]
    return (
      <span className="flex flex-col items-center gap-1 shrink-0">
        {m ? (
          <Link to={`/materials/${slugify(m.name)}`} title={m.name} className={`${size} shrink-0 flex items-center justify-center hover:opacity-75 transition-opacity`}>
            {m.image_url ? <img src={m.image_url} alt={m.name} className="w-full h-full object-contain" /> : <span className="text-lg">🧪</span>}
          </Link>
        ) : <span className={`${size} shrink-0`} />}
        {editable && isAdmin && editIcons && (
          <span className="flex gap-1">
            <IconDbPicker
              onUploaded={url => changeIcon(matKey, url)}
              buttonLabel="✎"
              buttonClassName={ICON_EDIT_BTN}
            />
            <PasteImageButton onUploaded={url => changeIcon(matKey, url)} className={ICON_EDIT_BTN} />
          </span>
        )}
      </span>
    )
  }

  function MatChip({ matKey, qty }) {
    const m = materialsById[PET_MAT[matKey]]
    return (
      <span className="flex items-center gap-1.5 text-sm text-gray-200">
        <MatIcon matKey={matKey} size="w-7 h-7" />
        <span className="truncate">{m?.name ?? '?'}</span>
        <span className="text-gray-500 text-xs">×{qty}</span>
      </span>
    )
  }

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>

  const skillByKey = Object.fromEntries(PET_SKILLS.map(s => [s.key, s]))
  const priceModalRows = (priceModal?.keys ?? []).map(key => materialsById[PET_MAT[key]]).filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PET_TABS.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                tab === key
                  ? 'bg-yellow-400 text-gray-950 border-yellow-400'
                  : horizontal ? 'bg-black/30 border-white/10 text-gray-300 hover:text-yellow-400' : 'bg-gray-800 border-gray-600 text-gray-300 hover:text-yellow-400'
              }`}
            >
              {t(`pet.tab.${key}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (tab === 'potions' || tab === 'skills') && (
            <button type="button" onClick={() => setEditIcons(v => !v)} className={`${smallBtn} ${editIcons ? '!bg-yellow-400 !text-gray-950 !border-yellow-400' : ''}`}>
              {t('pet.editIcons')}
            </button>
          )}
          <PriceModeToggle mode={mode} setMode={setMode} horizontal={horizontal} />
        </div>
      </div>

      {tab === 'all' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset(null)} className={smallBtn}>{t('pet.clear')}</button>
            <button type="button" onClick={() => applyPreset('pvm')} className={smallBtn}>{t('pet.pvmPet')}</button>
            <button type="button" onClick={() => applyPreset('pvp')} className={smallBtn}>{t('pet.pvpPet')}</button>
          </div>
          <div className={`${panel} divide-y ${divider}`}>
            {PET_TABS.filter(k => k !== 'all').map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${horizontal ? 'hover:bg-white/5' : 'hover:bg-gray-800'}`}
              >
                <span className="flex-1 text-sm font-semibold text-gray-100">{t(`pet.tab.${key}`)}</span>
                <span className="text-yellow-400 text-sm w-32 text-right font-mono shrink-0">{formatYang(costOf(key).total)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'evolution' && (
        <div className={`${panel} divide-y ${divider}`}>
          <p className="px-5 py-3 text-xs text-gray-500">{t('pet.evolutionHint')}</p>
          {EVOLUTIONS.map(evo => {
            const on = choices.evolutions[evo.key]
            return (
              <label key={evo.key} className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 cursor-pointer ${on ? '' : 'opacity-50'}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => updateChoices(c => ({ ...c, evolutions: { ...c.evolutions, [evo.key]: !on } }))}
                  className="accent-yellow-400 w-4 h-4 shrink-0"
                />
                <span className="w-32 shrink-0">
                  <span className="block text-sm font-semibold text-gray-100">{t('pet.evolution')}</span>
                  <span className="block text-xs text-gray-500">{t('pet.levelRange', { range: evo.label })}</span>
                </span>
                <span className="flex flex-wrap gap-x-5 gap-y-2 flex-1">
                  {evo.mats.map(([key, qty]) => <MatChip key={key} matKey={key} qty={qty} />)}
                </span>
                <span className="text-yellow-400 text-sm font-mono">{formatYang(evo.yang)}</span>
              </label>
            )
          })}
        </div>
      )}

      {tab === 'type' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              {t('pet.currentType')}
              <select
                value={choices.type.owned}
                onChange={e => updateChoices(c => ({ ...c, type: { ...c.type, owned: Number(e.target.value) } }))}
                className={horizontal
                  ? 'bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-yellow-400'
                  : 'bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-yellow-400'}
              >
                {Array.from({ length: TYPE_MAX - TYPE_MIN }, (_, i) => TYPE_MIN + i).map(n => <option key={n} value={n}>{t('pet.typeN', { n })}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => updateChoices(c => ({ ...c, type: { ...c.type, pity: {} } }))} className={smallBtn}>{t('itemDetail.resetPityAllSteps')}</button>
            <button type="button" onClick={() => updateChoices(c => ({ ...c, type: { ...c.type, pity: Object.fromEntries(TYPE_STEPS.map(s => [s.type, TYPE_MAX_PITY])) } }))} className={smallBtn}>{t('itemDetail.maxPityAllSteps')}</button>
          </div>
          <div className={`${panel} divide-y ${divider}`}>
            {TYPE_STEPS.map(step => {
              const owned = step.type <= choices.type.owned
              const excluded = !owned && !!choices.type.excluded[step.type]
              const pity = typePityOf(choices, step.type)
              const stepCost = step.mats.reduce((sum, [key, qty]) => sum + priceFn(PET_MAT[key]) * qty, 0) * (pity + 1)
              return (
                <div key={step.type} className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 ${owned || excluded ? 'opacity-40' : ''}`}>
                  <span className="flex items-center gap-2 w-32 shrink-0">
                    {!owned && (
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => updateChoices(c => ({ ...c, type: { ...c.type, excluded: { ...c.type.excluded, [step.type]: !c.type.excluded[step.type] } } }))}
                        className="accent-yellow-400 w-4 h-4 shrink-0"
                        title={t('itemDetail.includeStepTooltip')}
                      />
                    )}
                    <span className="text-sm font-semibold text-gray-100">{t('pet.typeN', { n: step.type - 1 })} → {step.type}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-5 gap-y-2 flex-1">
                    {step.mats.map(([key, qty]) => <MatChip key={key} matKey={key} qty={qty * (pity + 1)} />)}
                  </span>
                  <PityStepper
                    value={pity}
                    max={TYPE_MAX_PITY}
                    onChange={next => updateChoices(c => ({ ...c, type: { ...c.type, pity: { ...c.type.pity, [step.type]: Math.min(TYPE_MAX_PITY, next) } } }))}
                    title={t('itemDetail.pityMax', { max: TYPE_MAX_PITY })}
                  />
                  <span className={`text-sm font-mono w-28 text-right shrink-0 ${owned || excluded ? 'text-gray-600 line-through' : 'text-yellow-400'}`}>{formatYang(stepCost)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'potions' && (
        <>
          <p className="text-xs text-gray-500">{t('pet.potionsHint', { n: POTION_SUCCESSES_PER_SIZE, avg: POTION_SUCCESSES_PER_SIZE * POTION_DEFAULT_FACTOR })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => updateChoices(c => ({ ...c, potions: { ...c.potions, qty: Object.fromEntries(Object.keys(c.potions.qty).map(k => [k, String(POTION_SUCCESSES_PER_SIZE)])) } }))} className={smallBtn}>
              {t('pet.minimalPrice')}
            </button>
            <button type="button" onClick={() => updateChoices(c => ({ ...c, potions: { ...c.potions, qty: defaultPetChoices().potions.qty } }))} className={smallBtn}>
              {t('pet.averagePrice')}
            </button>
            <button type="button" onClick={() => setPriceModal({ title: t('pet.potionPrices'), keys: POTION_GROUPS.flatMap(g => POTION_SIZES.map(s => potionKey(g.key, s.key))) })} className={smallBtn}>
              💲 {t('pet.potionPrices')}
            </button>
          </div>
          {POTION_GROUPS.map(group => {
            const on = choices.potions.groups[group.key]
            return (
              <div key={group.key} className={`${panel} ${on ? '' : 'opacity-50'}`}>
                <label className={`flex items-center gap-2 px-5 py-3 border-b cursor-pointer ${horizontal ? 'border-white/10' : 'border-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => updateChoices(c => ({ ...c, potions: { ...c.potions, groups: { ...c.potions.groups, [group.key]: !on } } }))}
                    className="accent-yellow-400 w-4 h-4 shrink-0"
                  />
                  <span className="text-sm font-bold text-gray-100">{group.label}</span>
                </label>
                <div className={`divide-y ${divider}`}>
                  {POTION_SIZES.map(size => {
                    const key = potionKey(group.key, size.key)
                    const qty = potionsOf(choices.potions.qty[key])
                    return (
                      <div key={size.key} className="flex items-center gap-3 px-5 py-2.5">
                        <MatIcon matKey={key} editable />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-gray-200 truncate">{materialsById[PET_MAT[key]]?.name ?? `${group.potion} (${size.label})`}</span>
                          <span className="block text-xs text-gray-500">{size.range}</span>
                        </span>
                        <span className="text-gray-500 text-xs">×</span>
                        <input
                          type="number"
                          min={POTION_SUCCESSES_PER_SIZE}
                          value={choices.potions.qty[key]}
                          onChange={e => updateChoices(c => ({ ...c, potions: { ...c.potions, qty: { ...c.potions.qty, [key]: e.target.value } } }))}
                          onBlur={() => updateChoices(c => ({ ...c, potions: { ...c.potions, qty: { ...c.potions.qty, [key]: String(potionsOf(c.potions.qty[key])) } } }))}
                          className={inputCls}
                        />
                        <span className="text-yellow-400 text-sm w-28 text-right font-mono shrink-0">{formatYang(priceFn(PET_MAT[key]) * qty)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}

      {tab === 'skills' && (
        <>
          <div className={`${panel} flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3`}>
            <MatIcon matKey={UNLOCKER_KEY} editable />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-100">{materialsById[PET_MAT[UNLOCKER_KEY]]?.name ?? 'Pet Unlocker'}</span>
              <span className="block text-xs text-gray-500">{t('pet.unlockerHint', { n: SKILL_SLOTS })}</span>
            </span>
            <span className="text-yellow-400 text-sm font-mono">{formatYang(priceFn(PET_MAT[UNLOCKER_KEY]))}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPriceModal({ title: t('pet.bookPrices'), keys: PET_SKILLS.map(s => bookKey(s.key)) })} className={smallBtn}>
              💲 {t('pet.bookPrices')}
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {choices.skills.slots.map((skill, i) => {
              const book = skill ? materialsById[PET_MAT[bookKey(skill)]] : null
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSkillPickerSlot(i)}
                  title={skill ? skillByKey[skill]?.name : t('pet.emptySlot')}
                  className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 transition-colors ${
                    skill ? 'border-yellow-400/50 bg-yellow-400/5 hover:border-yellow-300' : `border-dashed ${horizontal ? 'border-white/15 bg-black/20' : 'border-gray-600 bg-gray-900'} hover:border-yellow-300`
                  }`}
                >
                  {skill ? (
                    <>
                      {book?.image_url ? <img src={book.image_url} alt="" className="w-9 h-9 object-contain" /> : <span className="text-2xl">📘</span>}
                      <span className="text-[11px] leading-tight text-center text-gray-200">{skillByKey[skill]?.name}</span>
                    </>
                  ) : <span className="text-2xl text-gray-600">+</span>}
                </button>
              )
            })}
          </div>

          {choices.skills.slots.some(Boolean) && (
            <div className={`${panel} divide-y ${divider}`}>
              <p className="px-5 py-3 text-xs text-gray-500">{t('pet.booksHint', { min: MIN_BOOKS })}</p>
              {choices.skills.slots.map((skill, i) => {
                if (!skill) return null
                const key = bookKey(skill)
                const books = booksOf(choices.skills.books[i])
                const cost = priceFn(PET_MAT[UNLOCKER_KEY]) + books * priceFn(PET_MAT[key])
                return (
                  <div key={i} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <MatIcon matKey={key} editable />
                    <span className="flex-1 min-w-0 text-sm font-semibold text-gray-100 truncate">{skillByKey[skill]?.name}</span>
                    <span className="text-xs text-gray-500">{t('pet.books')}</span>
                    <input
                      type="number"
                      min={MIN_BOOKS}
                      value={choices.skills.books[i]}
                      onChange={e => updateChoices(c => ({ ...c, skills: { ...c.skills, books: c.skills.books.map((b, j) => j === i ? e.target.value : b) } }))}
                      onBlur={() => updateChoices(c => ({ ...c, skills: { ...c.skills, books: c.skills.books.map((b, j) => j === i ? String(booksOf(b)) : b) } }))}
                      className={inputCls}
                    />
                    <span className="text-xs text-gray-500">+ 1 {materialsById[PET_MAT[UNLOCKER_KEY]]?.name ?? 'Pet Unlocker'}</span>
                    <span className="text-yellow-400 text-sm w-28 text-right font-mono shrink-0">{formatYang(cost)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <div className={panel}>
        <h2 className={`px-5 py-3 text-sm font-semibold text-gray-300 border-b ${horizontal ? 'border-white/10' : 'border-gray-700'}`}>
          {t('itemDetail.materialsSummaryTitle')}
        </h2>
        <div className="flex flex-col gap-2 px-5 py-4">
          {mats.length === 0 && yang === 0 && <p className="text-sm text-gray-500 text-center py-2">{t('itemDetail.noMaterialsDefined')}</p>}
          {mats.map(([id, qty]) => materialsById[id] && (
            <MatRow
              key={id}
              mat={materialsById[id]}
              quantity={qty}
              unitPrice={priceFn(id)}
              rawValue={rawInputs[id]}
              onPriceChange={setPrice}
              globalMode={mode === 'global'}
              manualOverrides={manualOverrides}
              onToggleManualOverride={toggleManualOverride}
            />
          ))}
          {yang > 0 && (
            <div className="flex items-center gap-3 pt-2">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center text-lg">💰</span>
              <span className="flex-1 text-sm text-gray-200">{t('pet.yangFees')}</span>
              <span className="text-yellow-400 text-sm text-right font-mono shrink-0 whitespace-nowrap">{formatYang(yang)}</span>
            </div>
          )}
        </div>
      </div>

      <StickyTotalBar sticky={stickyTotal}>
        <div className={`${horizontal ? 'bg-black/40 border border-yellow-400/20 rounded-xl' : 'bg-gray-900 border border-yellow-400/20 rounded-2xl'} px-6 py-5`}>
          <div className="flex justify-between items-center">
            <span className="text-gray-300 font-semibold">{t('itemDetail.totalCost')}</span>
            <span className="text-3xl font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 mt-3 cursor-pointer select-none">
            <input type="checkbox" checked={stickyTotal} onChange={e => setStickyTotal(e.target.checked)} className="accent-yellow-400 w-3.5 h-3.5" />
            {t('common.stickToBottom')}
          </label>
        </div>
      </StickyTotalBar>

      {priceModal && createPortal(
        <Modal title={priceModal.title} onClose={() => setPriceModal(null)} maxWidthClass="max-w-xl" horizontal={horizontal}>
          <div className="flex justify-center mb-4">
            <PriceModeToggle mode={mode} setMode={setMode} horizontal={horizontal} />
          </div>
          <div className="flex flex-col">
            {priceModalRows.map(mat => {
              const manualOverride = manualOverrides?.has(mat.id) ?? false
              const canOverride = !mat.no_price && !FIXED_MATERIAL_PRICES[mat.id]
              return (
                <div key={mat.id} className={`flex items-center gap-3 border-t py-2.5 ${horizontal ? 'border-white/10' : 'border-gray-700'}`}>
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center">
                    {mat.image_url ? <img src={mat.image_url} alt="" className="w-7 h-7 object-contain" /> : <span className="text-sm">🧪</span>}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm text-gray-200">{mat.name}</span>
                  {canOverride && mode === 'global' && (
                    <label className="flex items-center cursor-pointer select-none" title={t('materials.manualPrice')}>
                      <input type="checkbox" checked={manualOverride} onChange={() => toggleManualOverride(mat.id)} className="accent-yellow-400 w-3 h-3" />
                    </label>
                  )}
                  <div className="w-32 shrink-0">
                    <MaterialPriceCell
                      material={mat}
                      rawValue={rawInputs[mat.id]}
                      computedValue={priceFn(mat.id)}
                      onPriceChange={setPrice}
                      computed={manualOverride ? false : (mode === 'global' ? true : undefined)}
                      manualOverride={manualOverride}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Modal>,
        document.body,
      )}

      {skillPickerSlot != null && createPortal(
        <Modal title={t('pet.chooseSkill')} onClose={() => setSkillPickerSlot(null)} horizontal={horizontal}>
          <div className="flex flex-col gap-2">
            {PET_SKILLS.map(skill => {
              const current = choices.skills.slots[skillPickerSlot] === skill.key
              const usedElsewhere = !current && choices.skills.slots.includes(skill.key)
              const book = materialsById[PET_MAT[bookKey(skill.key)]]
              return (
                <button
                  key={skill.key}
                  type="button"
                  disabled={usedElsewhere}
                  onClick={() => {
                    updateChoices(c => ({ ...c, skills: { ...c.skills, slots: c.skills.slots.map((s, j) => j === skillPickerSlot ? skill.key : s) } }))
                    setSkillPickerSlot(null)
                  }}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${
                    current ? 'border-yellow-400 bg-yellow-400/10' : horizontal ? 'border-white/10 bg-black/30 hover:border-yellow-300' : 'border-gray-700 bg-gray-800 hover:border-yellow-300'
                  } ${usedElsewhere ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="w-7 h-7 shrink-0 flex items-center justify-center">
                    {book?.image_url ? <img src={book.image_url} alt="" className="max-w-full max-h-full object-contain" /> : <span>📘</span>}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-gray-100">{skill.name}</span>
                  {usedElsewhere && <span className="text-xs text-gray-500">{t('pet.alreadyUsed')}</span>}
                </button>
              )
            })}
            {choices.skills.slots[skillPickerSlot] && (
              <button
                type="button"
                onClick={() => {
                  updateChoices(c => ({ ...c, skills: { ...c.skills, slots: c.skills.slots.map((s, j) => j === skillPickerSlot ? null : s) } }))
                  setSkillPickerSlot(null)
                }}
                className="mt-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-300 border border-red-400/40 hover:bg-red-500/10"
              >
                {t('pet.removeSkill')}
              </button>
            )}
          </div>
        </Modal>,
        document.body,
      )}
    </div>
  )
}

