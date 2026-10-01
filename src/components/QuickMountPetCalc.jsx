import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import { formatYang } from '../utils/formatYang'
import {
  MAT, LEVEL_STAGES, BONUS_ENCHANTS, MOUNT_SKILLS, SKILL_LEVELS, RUNES, RUNE_STEPS, RUNE_MAX_PITY,
  MOUNT_CHOICES_KEY, loadMountChoices, mountPartCost,
} from '../utils/mountSystem'
import {
  EVOLUTIONS, TYPE_MIN, TYPE_MAX, TYPE_MAX_PITY, TYPE_STEPS, PET_SKILLS, PET_CHOICES_KEY, ORB_POTION_CHANCE,
  loadPetChoices, applyPetPreset, petPartCost, typePityOf, booksOf, withPetDefaults,
} from '../utils/petSystem'

// Compact versions of the Mount / Pet calculators shown over the Build Calculator.
// They edit the same localStorage choices as the full pages, so both stay in sync.

const costOf = ({ mats, yang }, priceFn) => yang + mats.reduce((sum, [id, qty]) => sum + priceFn(id) * qty, 0)

function useStyles(horizontal) {
  return {
    field: horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-600',
    box: horizontal ? 'border-white/10 bg-black/20' : 'border-gray-700 bg-gray-800/40',
  }
}

function Section({ title, cost, to, onNavigate, box, children }) {
  return (
    <div className={`border rounded-xl px-3 py-2.5 ${box}`}>
      <div className={`flex items-center justify-between gap-3 ${children ? 'mb-2' : ''}`}>
        <Link to={to} onClick={onNavigate} className="text-xs font-bold text-yellow-400 uppercase tracking-wider hover:text-yellow-200">{title} →</Link>
        <span className="text-xs font-mono text-yellow-400">{formatYang(cost)}</span>
      </div>
      {children}
    </div>
  )
}

function PityInput({ value, max, onChange, field, disabled }) {
  return (
    <input
      type="number"
      min="0"
      max={max}
      value={value}
      disabled={disabled}
      onChange={e => onChange(Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))}
      className={`border rounded-md px-1 py-0.5 w-10 text-center text-xs text-white focus:outline-none focus:border-yellow-400 disabled:opacity-30 ${field}`}
    />
  )
}

function PityOverrideNote({ pityMode, onPityModeChange }) {
  const { t } = useTranslation()
  if (!pityMode) return null
  return (
    <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-xs text-yellow-200">
        {t('buildCalculator.pityOverrideActive', { mode: t(pityMode === 'zero' ? 'buildCalculator.pityZero' : 'buildCalculator.pityMax') })}
      </span>
      <button type="button" onClick={() => onPityModeChange(null)} className="text-xs font-semibold text-yellow-300 hover:text-yellow-100 underline">
        {t('buildCalculator.turnOff')}
      </button>
    </div>
  )
}

function TotalBar({ total, box }) {
  const { t } = useTranslation()
  return (
    <div className={`mt-3 border rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 ${box}`}>
      <span className="text-sm text-gray-300 font-semibold">{t('itemDetail.totalCost')}</span>
      <span className="text-lg font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
    </div>
  )
}

// parts = [{ key, label, part, to }] — the Mount parts ticked on the board.
export function QuickMountCalc({ parts, priceFn, materialsById, pityMode, onPityModeChange, onChange, onClose, horizontal }) {
  const { t } = useTranslation()
  const { field, box } = useStyles(horizontal)
  const [choices, setChoices] = useState(loadMountChoices)

  function update(fn) {
    const next = fn(choices)
    setChoices(next)
    try { localStorage.setItem(MOUNT_CHOICES_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
    onChange()
  }
  const setRune = (key, fn) => update(c => ({ ...c, runes: { ...c.runes, [key]: fn(c.runes[key]) } }))
  const matName = key => materialsById[MAT[key]]?.name ?? key

  let total = 0
  const sections = parts.map(p => {
    const cost = costOf(mountPartCost(p.part, choices), priceFn)
    total += cost
    let body = null
    if (p.part === 'level') {
      body = (
        <div className="flex flex-wrap gap-1.5">
          {LEVEL_STAGES.map(stage => (
            <label key={stage.key} className={`flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs cursor-pointer ${field} ${stage.kind === 'evo' ? 'text-yellow-200' : 'text-gray-200'}`}>
              <input
                type="checkbox"
                checked={!!choices.stages[stage.key]}
                onChange={() => update(c => ({ ...c, stages: { ...c.stages, [stage.key]: !c.stages[stage.key] } }))}
                className="accent-yellow-400"
              />
              {stage.kind === 'evo' ? t('mount.evolution', { n: stage.evo }) : t('mount.levelRange', { range: stage.label })}
            </label>
          ))}
        </div>
      )
    } else if (p.part === 'bonus') {
      body = (
        <div className="flex flex-wrap gap-2">
          {BONUS_ENCHANTS.map(key => (
            <label key={key} className="flex items-center gap-1.5 text-xs text-gray-300">
              {materialsById[MAT[key]]?.image_url && <img src={materialsById[MAT[key]].image_url} alt="" className="w-5 h-5 object-contain" />}
              <span className="truncate max-w-32">{matName(key)}</span>
              <input
                type="number"
                min="0"
                value={choices.enchantQty[key]}
                onChange={e => update(c => ({ ...c, enchantQty: { ...c.enchantQty, [key]: e.target.value } }))}
                className={`border rounded-md px-1.5 py-0.5 w-16 text-center text-xs text-white focus:outline-none focus:border-yellow-400 ${field}`}
              />
            </label>
          ))}
        </div>
      )
    } else if (p.part === 'skills') {
      body = (
        <div className="flex flex-col gap-1">
          {MOUNT_SKILLS.map(skill => {
            const c = choices.skills[skill.key]
            const set = patch => update(prev => ({ ...prev, skills: { ...prev.skills, [skill.key]: { ...prev.skills[skill.key], ...patch } } }))
            return (
              <div key={skill.key} className={`flex items-center gap-2 flex-wrap text-xs ${c.enabled ? '' : 'opacity-40'}`}>
                <label className="flex items-center gap-1.5 flex-1 min-w-40 text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={c.enabled} onChange={() => set({ enabled: !c.enabled })} className="accent-yellow-400" />
                  {skill.name}
                </label>
                <label className="flex items-center gap-1 text-gray-400" title={t('mount.booksPerLevel')}>
                  📖
                  <input
                    type="number"
                    min="0"
                    value={c.books}
                    disabled={!c.enabled}
                    onChange={e => set({ books: e.target.value })}
                    className={`border rounded-md px-1 py-0.5 w-12 text-center text-white focus:outline-none focus:border-yellow-400 ${field}`}
                  />
                  <span className="text-gray-500">×{SKILL_LEVELS}</span>
                </label>
                <label className="flex items-center gap-1 text-gray-400 cursor-pointer" title={t('mount.readingHint')}>
                  <input type="checkbox" checked={c.reading} disabled={!c.enabled} onChange={() => set({ reading: !c.reading })} className="accent-yellow-400" />
                  {matName('focusedReading')}
                </label>
              </div>
            )
          })}
        </div>
      )
    } else if (p.part === 'all') {
      body = (
        <div className="flex flex-col gap-2">
          {RUNES.map(rune => {
            const c = choices.runes[rune.key]
            return (
              <div key={rune.key} className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 w-32 shrink-0 text-xs text-gray-200">
                  <img src={rune.image} alt="" className="w-5 h-5 object-contain" />
                  {rune.name}
                </span>
                <select
                  value={c.owned}
                  onChange={e => setRune(rune.key, r => ({ ...r, owned: Number(e.target.value) }))}
                  title={t('mount.ownedLevel')}
                  className={`border rounded-md px-1 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-yellow-400 ${field}`}
                >
                  {Array.from({ length: RUNE_STEPS + 1 }, (_, n) => <option key={n} value={n}>+{n}</option>)}
                </select>
                <span className="text-[11px] text-gray-500" title={t('mount.pityHint', { max: RUNE_MAX_PITY })}>{t('mount.pity')}</span>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: RUNE_STEPS }, (_, i) => i + 1).map(step => (
                    <label key={step} className="flex flex-col items-center text-[10px] text-gray-500 leading-none gap-0.5">
                      +{step}
                      <PityInput
                        value={Math.min(RUNE_MAX_PITY, Math.max(0, parseInt(c.pity[step]) || 0))}
                        max={RUNE_MAX_PITY}
                        disabled={step <= c.owned || !!c.excluded[step]}
                        onChange={v => setRune(rune.key, r => ({ ...r, pity: { ...r.pity, [step]: v } }))}
                        field={field}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )
    }
    return <Section key={p.key} title={p.label} cost={cost} to={p.to} onNavigate={onClose} box={box}>{body}</Section>
  })

  return (
    <Modal title={t('buildCalculator.slots.mount')} onClose={onClose} maxWidthClass="max-w-2xl" horizontal={horizontal}>
      {parts.some(p => p.part === 'all') && <PityOverrideNote pityMode={pityMode} onPityModeChange={onPityModeChange} />}
      <div className="flex flex-col gap-2">{sections}</div>
      <TotalBar total={total} box={box} />
    </Modal>
  )
}

// build = 'pvm' | 'pvp' — the preset chosen on the board, applied over the saved choices
// (it decides the skills, potion groups and the PvP orb, so those aren't editable here).
export function QuickPetCalc({ build, to, priceFn, pityMode, onPityModeChange, onChange, onClose, horizontal }) {
  const { t } = useTranslation()
  const { field, box } = useStyles(horizontal)
  const [choices, setChoices] = useState(loadPetChoices)
  const petPriceFn = withPetDefaults(priceFn)
  const effective = applyPetPreset(choices, build)

  function update(fn) {
    const next = fn(choices)
    setChoices(next)
    try { localStorage.setItem(PET_CHOICES_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
    onChange()
  }

  const evoCost = costOf(petPartCost('evolution', effective), petPriceFn)
  const typeCost = costOf(petPartCost('type', effective), petPriceFn)
  const potionsCost = costOf(petPartCost('potions', effective), petPriceFn)
  const skillsCost = costOf(petPartCost('skills', effective), petPriceFn)
  const total = evoCost + typeCost + potionsCost + skillsCost
  const tab = name => to.replace(/tab=\w+/, `tab=${name}`)

  return (
    <Modal title={t(`pet.${build}Pet`)} onClose={onClose} maxWidthClass="max-w-2xl" horizontal={horizontal}>
      {!effective.orb && <PityOverrideNote pityMode={pityMode} onPityModeChange={onPityModeChange} />}
      <div className="flex flex-col gap-2">
        <Section title={t('pet.tab.evolution')} cost={evoCost} to={tab('evolution')} onNavigate={onClose} box={box}>
          <div className="flex flex-wrap gap-1.5">
            {EVOLUTIONS.map(evo => (
              <label key={evo.key} className={`flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs text-gray-200 cursor-pointer ${field}`}>
                <input
                  type="checkbox"
                  checked={!!choices.evolutions[evo.key]}
                  onChange={() => update(c => ({ ...c, evolutions: { ...c.evolutions, [evo.key]: !c.evolutions[evo.key] } }))}
                  className="accent-yellow-400"
                />
                {t('pet.levelRange', { range: evo.label })}
              </label>
            ))}
          </div>
        </Section>

        <Section title={t('pet.tab.type')} cost={typeCost} to={tab('type')} onNavigate={onClose} box={box}>
          {effective.orb ? (
            <p className="text-xs text-gray-400">{t('pet.orbHint', { chance: ORB_POTION_CHANCE * 100 })}</p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={choices.type.owned}
                onChange={e => update(c => ({ ...c, type: { ...c.type, owned: Number(e.target.value) } }))}
                title={t('pet.currentType')}
                className={`border rounded-md px-1 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-yellow-400 ${field}`}
              >
                {Array.from({ length: TYPE_MAX - TYPE_MIN + 1 }, (_, i) => TYPE_MIN + i).map(n => (
                  <option key={n} value={n}>{t('pet.typeN', { n })}</option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500">{t('itemDetail.pityMax', { max: TYPE_MAX_PITY })}</span>
              <div className="flex flex-wrap gap-1">
                {TYPE_STEPS.map(step => (
                  <label key={step.type} className="flex flex-col items-center text-[10px] text-gray-500 leading-none gap-0.5">
                    {t('pet.typeN', { n: step.type })}
                    <PityInput
                      value={typePityOf(choices, step.type)}
                      max={TYPE_MAX_PITY}
                      disabled={step.type <= choices.type.owned || !!choices.type.excluded[step.type]}
                      onChange={v => update(c => ({ ...c, type: { ...c.type, pity: { ...c.type.pity, [step.type]: v } } }))}
                      field={field}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title={t('pet.tab.skills')} cost={skillsCost} to={tab('skills')} onNavigate={onClose} box={box}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {effective.skills.slots.map((skill, i) => skill && (
              <label key={i} className="flex items-center gap-2 text-xs text-gray-200">
                <span className="flex-1 truncate">{PET_SKILLS.find(s => s.key === skill)?.name ?? skill}</span>
                <span className="text-gray-500">{t('pet.books')}</span>
                <input
                  type="number"
                  min="0"
                  value={choices.skills.books[i]}
                  onChange={e => update(c => ({ ...c, skills: { ...c.skills, books: c.skills.books.map((b, j) => (j === i ? e.target.value : b)) } }))}
                  onBlur={() => update(c => ({ ...c, skills: { ...c.skills, books: c.skills.books.map((b, j) => (j === i ? String(booksOf(b)) : b)) } }))}
                  className={`border rounded-md px-1 py-0.5 w-14 text-center text-white focus:outline-none focus:border-yellow-400 ${field}`}
                />
              </label>
            ))}
          </div>
        </Section>

        <Section title={t('pet.tab.potions')} cost={potionsCost} to={tab('potions')} onNavigate={onClose} box={box} />
      </div>
      <TotalBar total={total} box={box} />
    </Modal>
  )
}
