import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import IconDbPicker from './IconDbPicker'
import PasteImageButton from './PasteImageButton'
import { formatYang } from '../utils/formatYang'

// Dragon-stone alchemy window for the build calculator, drawn over
// public/alchemy_bg.webp (1254×1254). One stone per colour; each can be set to
// one grade. Stones/prices come from the Alchemy system (alchemy_stones,
// '<stone_id>:<grade>' price keys); per-grade icons are picked by an admin.
const BG = 1254
const SLOT = 152
export const ALCHEMY_POSITIONS = [
  { name: 'Diamond', x: 552, y: 108 },
  { name: 'Onyx', x: 893, y: 324 },
  { name: 'Garnet', x: 893, y: 691 },
  { name: 'Sapphire', x: 557, y: 868 },
  { name: 'Jade', x: 211, y: 691 },
  { name: 'Ruby', x: 210, y: 324 },
]
export const ALCHEMY_GRADES = [ // top of the list first
  { key: 'excellent', label: 'Excellent' },
  { key: 'brilliant', label: 'Brilliant' },
  { key: 'flawless', label: 'Flawless' },
  { key: 'clear', label: 'Clear' },
  { key: 'matt', label: 'Matt' },
]
export const alchemyKey = (stoneId, grade) => `${stoneId}:${grade}`
export const gradeLabel = grade => ALCHEMY_GRADES.find(g => g.key === grade)?.label ?? grade

const ICON_EDIT_BTN = 'text-[10px] leading-none px-1.5 py-0.5 rounded border border-dashed border-yellow-400/50 text-yellow-300 hover:bg-yellow-400/10 disabled:opacity-50'

export default function AlchemyPicker({ stonesByName, chosen, onChoose, iconOf, onIconChange, priceOf, onClose, horizontal }) {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [activeStone, setActiveStone] = useState(null)
  const [editIcons, setEditIcons] = useState(false)
  const tile = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-700'
  const stone = activeStone ? stonesByName[activeStone] : null

  return (
    <Modal title={t('buildCalculator.slots.alchemy')} onClose={onClose} maxWidthClass="max-w-2xl" horizontal={horizontal}>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setEditIcons(v => !v)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${editIcons ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'border-white/10 text-gray-300 hover:text-yellow-400'}`}
          >
            {t('pet.editIcons')}
          </button>
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        <div className="relative w-full md:w-80 shrink-0 aspect-square select-none">
          <img src="/alchemy_bg.webp" alt="" draggable={false} className="absolute inset-0 w-full h-full rounded-lg" />
          {ALCHEMY_POSITIONS.map(pos => {
            const s = stonesByName[pos.name]
            const grade = s ? chosen[s.id] : null
            return (
              <button
                key={pos.name}
                type="button"
                disabled={!s}
                title={s ? (grade ? `${s.name} (${gradeLabel(grade)})` : s.name) : pos.name}
                onClick={() => setActiveStone(pos.name)}
                className={`absolute flex items-center justify-center rounded-md transition-shadow ${activeStone === pos.name ? 'ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]' : 'hover:ring-2 hover:ring-yellow-300'}`}
                style={{ left: `${(pos.x / BG) * 100}%`, top: `${(pos.y / BG) * 100}%`, width: `${(SLOT / BG) * 100}%`, height: `${(SLOT / BG) * 100}%` }}
              >
                {grade && <img src={iconOf(s, grade)} alt="" className="w-[80%] h-[80%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />}
              </button>
            )
          })}
        </div>

        <div className="flex-1 w-full min-w-0">
          {!stone ? (
            <p className="text-sm text-gray-400">{t('buildCalculator.alchemyHint')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-gray-100 mb-1">{stone.name}</h3>
              {ALCHEMY_GRADES.map(g => {
                const active = chosen[stone.id] === g.key
                return (
                  <div key={g.key} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${active ? 'border-yellow-400 bg-yellow-400/10' : `${tile} hover:border-yellow-300`}`}>
                    <button type="button" onClick={() => onChoose(stone.id, g.key)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
                      <span className="w-8 h-8 shrink-0 flex items-center justify-center">
                        <img src={iconOf(stone, g.key)} alt="" className="max-w-full max-h-full object-contain" />
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-100">{stone.name} ({g.label})</span>
                      <span className="text-yellow-400 text-xs font-mono shrink-0">{formatYang(priceOf(alchemyKey(stone.id, g.key)))}</span>
                    </button>
                    {editIcons && (
                      <span className="flex gap-1 shrink-0">
                        <IconDbPicker onUploaded={url => onIconChange(alchemyKey(stone.id, g.key), url)} buttonLabel="✎" buttonClassName={ICON_EDIT_BTN} />
                        <PasteImageButton onUploaded={url => onIconChange(alchemyKey(stone.id, g.key), url)} className={ICON_EDIT_BTN} />
                      </span>
                    )}
                  </div>
                )
              })}
              {chosen[stone.id] && (
                <button type="button" onClick={() => onChoose(stone.id, null)} className="mt-1 px-3 py-2 rounded-lg text-sm font-semibold text-red-300 border border-red-400/40 hover:bg-red-500/10">
                  {t('buildCalculator.clearSlot')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
