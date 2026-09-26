import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import Modal from './Modal'
import IconDbPicker from './IconDbPicker'
import PasteImageButton from './PasteImageButton'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import PriceModeToggle from './PriceModeToggle'
import { itemImages } from '../utils/itemImages'
import { PVP_CATEGORY_ID } from '../utils/itemName'
import { formatYang } from '../utils/formatYang'
import { slugify } from '../utils/slug'
import {
  usePriceBook, buildRecipeMap, buildYangCostMap,
  computeItemPrice, buildItemStepMap, buildItemYangMap, buildItemMaxPityMap, buildDefaultScrollMap,
  fetchGlobalPrices, makeMaterialPriceFn,
} from '../utils/priceBook'
import { scrollsForItem } from '../utils/itemUpgradeRules'
import { MAT, RUNES, CHAPTER_1_ID, CHAPTER_2_ID, loadMountChoices, mountPartCost } from '../utils/mountSystem'
import { isPetSubcategory, loadPetChoices, applyPetPreset, petPartCost, withPetDefaults } from '../utils/petSystem'

// Equipment window for the build calculator, drawn over public/equipment_bg.webp.
// Slot rectangles are in the background image's own pixels (724×1093) and get
// converted to percentages, so the board scales with its container.
const BG_W = 724
const BG_H = 1093
const CUT = 18 // octagon corner cut, in image pixels
const PAD = 14 // gap between a slot's frame and the item icon, in image pixels

// `subcategory` = subcategory name the slot picks items from (in every chapter
// except PvP). `cells` = how many 1×1 grid cells tall the slot is; an icon covers
// as many cells as it is tall (32×64 → 2, 32×96 → 3), from the top — or centred
// with `center`. `emptyBg` hides the slot's placeholder art once something is equipped.
const SLOTS = [
  // Equipment (left panel)
  { id: 'weapon', x: 22, y: 4, w: 148, h: 446, cells: 3, emptyBg: '/equipment_slot_empty_1x3.webp', subcategory: 'Weapons' },
  { id: 'armor', x: 191, y: 4, w: 148, h: 446, cells: 3, center: true, subcategory: 'Armor' },
  { id: 'helmet', x: 361, y: 4, w: 146, h: 147 },
  { id: 'shield', x: 361, y: 154, w: 146, h: 147, subcategory: 'Shields' },
  { id: 'bracelet', x: 361, y: 302, w: 146, h: 148, subcategory: 'Bracelets' },
  { id: 'earrings', x: 548, y: 154, w: 147, h: 147, subcategory: 'Earrings' },
  { id: 'necklace', x: 548, y: 302, w: 147, h: 148, subcategory: 'Necklaces' },
  { id: 'ring1', x: 22, y: 489, w: 148, h: 147 },
  { id: 'belt', x: 191, y: 489, w: 148, h: 147, subcategory: 'Belts' },
  { id: 'crystal', x: 533, y: 503, w: 160, h: 144, shape: 'hex' },
  { id: 'ring2', x: 22, y: 673, w: 148, h: 147 },
  { id: 'boots', x: 191, y: 673, w: 148, h: 147, subcategory: 'Shoes' },
  { id: 'talisman', x: 361, y: 673, w: 146, h: 147 },
  // Bottom row
  { id: 'pet', x: 32, y: 913, w: 148, h: 150, pet: true },
  { id: 'extra2', x: 202, y: 913, w: 148, h: 150 },
  { id: 'mount', x: 371, y: 913, w: 148, h: 150, mount: true },
  { id: 'extra4', x: 542, y: 913, w: 148, h: 150 },
]

const STORAGE_KEY = 'build_planner_slots'
const MOUNT_KEY = 'build_planner_mount'
const MOUNT_ICON_SETTING = 'build_planner_mount_icon' // settings row, chosen by an admin
const PET_KEY = 'build_planner_pet' // 'pvm' | 'pvp' | absent
const PET_BUILDS = ['pvm', 'pvp']
const INNER_INSET = 12 // how far inside a slot's frame its dark interior starts, in image pixels

// Mount slot: several parts of the Mount calculator can be ticked at once, each
// priced with the choices saved on that calculator's page.
const MOUNT_PARTS = [
  { key: 'level', label: 'Mount LvL', part: 'level', chapterId: CHAPTER_1_ID, sub: 'Mount', iconMat: MAT.horseMedal },
  { key: 'bonus', label: 'Mount Bonus', part: 'bonus', chapterId: CHAPTER_1_ID, sub: 'Mount', iconMat: MAT.enchantMount1 },
  { key: 'skills', label: 'Mount Skills', part: 'skills', chapterId: CHAPTER_1_ID, sub: 'Mount', iconMat: MAT.skillBook },
  { key: 'runes', label: 'Mount Runes', part: 'all', chapterId: CHAPTER_2_ID, sub: 'Mount Runes', icon: RUNES[0].image },
]

function loadMountParts() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOUNT_KEY))
    return Array.isArray(saved) ? saved.filter(k => MOUNT_PARTS.some(p => p.key === k)) : []
  } catch {
    return []
  }
}

function loadEquipped() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

function saveEquipped(equipped) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(equipped))
  } catch { /* storage unavailable — the board still works for this visit */ }
}

function outline({ w, h, shape }) {
  if (shape === 'hex') {
    return `${w * 0.25},2 ${w * 0.75},2 ${w - 2},${h / 2} ${w * 0.75},${h - 2} ${w * 0.25},${h - 2} 2,${h / 2}`
  }
  const c = CUT
  return `${c},2 ${w - c},2 ${w - 2},${c} ${w - 2},${h - c} ${w - c},${h - 2} ${c},${h - 2} 2,${h - c} 2,${c}`
}

// Icons are 32 px wide and 32/64/96 px tall — one grid cell per 32 px.
function cellsOf(img) {
  return Math.min(3, Math.max(1, Math.round(img.naturalHeight / img.naturalWidth)))
}

function SlotIcon({ slot, equip, onSize }) {
  const cellH = slot.cells ? slot.h / slot.cells : slot.h
  const boxH = slot.cells ? cellH * Math.min(equip.cells ?? 1, slot.cells) : slot.h
  const top = slot.center ? (slot.h - boxH) / 2 : 0
  return (
    <>
      {slot.emptyBg && <img src={slot.emptyBg} alt="" draggable={false} className="absolute inset-0 w-full h-full pointer-events-none" />}
      <div
        className="absolute left-0 w-full flex items-center justify-center pointer-events-none"
        style={{ top: `${(top / slot.h) * 100}%`, height: `${(boxH / slot.h) * 100}%`, padding: `${(PAD / slot.h) * 100}% ${(PAD / slot.w) * 100}%` }}
      >
        <img
          src={equip.image}
          alt={equip.name}
          draggable={false}
          onLoad={e => onSize(cellsOf(e.currentTarget))}
          className="max-w-full max-h-full w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        />
      </div>
    </>
  )
}

// Covers the slot's baked-in background icon with an empty interior, then draws `icon`.
function SlotOverlayIcon({ slot, icon }) {
  const inset = { x: (INNER_INSET / slot.w) * 100, y: (INNER_INSET / slot.h) * 100 }
  return (
    <>
      <img
        src="/equipment_slot_empty_inner.webp"
        alt=""
        draggable={false}
        className="absolute pointer-events-none"
        style={{
          left: `${inset.x}%`, top: `${inset.y}%`, width: `${100 - 2 * inset.x}%`, height: `${100 - 2 * inset.y}%`,
          clipPath: 'polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ padding: `${(PAD / slot.h) * 100}% ${(PAD / slot.w) * 100}%` }}>
        <img src={icon} alt="" draggable={false} className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
      </div>
    </>
  )
}

function PetPicker({ selected, onSelect, onClose, icon, horizontal }) {
  const { t } = useTranslation()
  const tile = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-700'
  return (
    <Modal title={t('buildCalculator.slots.pet')} onClose={onClose} horizontal={horizontal}>
      <div className="grid grid-cols-2 gap-3">
        {PET_BUILDS.map(build => (
          <button
            key={build}
            type="button"
            onClick={() => onSelect(build)}
            className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-5 transition-colors hover:border-yellow-300 ${selected === build ? '!border-yellow-400 bg-yellow-400/10' : tile}`}
          >
            {icon && <img src={icon} alt="" className="w-10 h-10 object-contain" />}
            <span className="text-sm font-bold text-gray-100">{t(`pet.${build}Pet`)}</span>
          </button>
        ))}
      </div>
      {selected && (
        <button type="button" onClick={() => onSelect(null)} className="mt-4 w-full px-3 py-2 rounded-lg text-sm font-semibold text-red-300 border border-red-400/40 hover:bg-red-500/10">
          {t('buildCalculator.clearSlot')}
        </button>
      )}
    </Modal>
  )
}

function MountPicker({ selected, onToggle, onClose, chapterNames, materialsById, icon, onIconChange, horizontal }) {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const tile = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-700'
  return (
    <Modal title={t('buildCalculator.slots.mount')} onClose={onClose} horizontal={horizontal}>
      <div className="flex flex-col gap-2">
        {MOUNT_PARTS.map(part => {
          const icon = part.icon ?? materialsById[part.iconMat]?.image_url
          return (
            <label key={part.key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors hover:border-yellow-300 ${tile}`}>
              <input type="checkbox" checked={selected.includes(part.key)} onChange={() => onToggle(part.key)} className="accent-yellow-400 w-4 h-4 shrink-0" />
              <span className="w-7 h-7 shrink-0 flex items-center justify-center">
                {icon && <img src={icon} alt="" className="max-w-full max-h-full object-contain" />}
              </span>
              <span className="flex-1 text-sm font-semibold text-gray-100">{part.label}</span>
              <span className="text-xs text-gray-400 shrink-0">{chapterNames[part.chapterId]}</span>
            </label>
          )
        })}
      </div>
      {isAdmin && (
        <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap ${tile}`}>
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-black/30">
            {icon ? <img src={icon} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-500">—</span>}
          </span>
          <span className="flex-1 text-xs text-gray-400">{t('buildCalculator.mountIconHint')}</span>
          <IconDbPicker onUploaded={onIconChange} />
          <PasteImageButton
            onUploaded={onIconChange}
            label="📋 Paste"
            className="bg-gray-800 border border-dashed border-gray-500 hover:border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          />
        </div>
      )}
    </Modal>
  )
}

function ItemPicker({ slot, items, current, onPick, onClear, onClose, horizontal }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const shown = items.filter(i => !q || i.name.toLowerCase().includes(q))
  const tile = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-800 border-gray-700'

  return (
    <Modal title={t(`buildCalculator.slots.${slot.id}`)} onClose={onClose} maxWidthClass="max-w-2xl" horizontal={horizontal}>
      <div className="flex items-center gap-2 mb-4">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('buildCalculator.pickerSearch')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm text-white border focus:outline-none focus:border-yellow-400 ${tile}`}
        />
        {current && (
          <button type="button" onClick={onClear} className="px-3 py-2 rounded-lg text-sm font-semibold text-red-300 border border-red-400/40 hover:bg-red-500/10">
            {t('buildCalculator.clearSlot')}
          </button>
        )}
      </div>
      {shown.length === 0 && <p className="text-sm text-gray-400">{t('buildCalculator.noItems')}</p>}
      <div className="flex flex-col gap-3">
        {shown.map(item => (
          <div key={item.id} className={`rounded-xl border p-3 ${tile}`}>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-100">{item.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{item.chapterName}</span>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {itemImages(item).map(url => {
                const active = current?.itemId === item.id && current?.image === url
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onPick(item, url)}
                    className={`w-14 min-h-14 p-1.5 rounded-lg border flex items-center justify-center transition-colors ${active ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 hover:border-yellow-300 hover:bg-white/5'}`}
                  >
                    <img src={url} alt={item.name} className="w-8 h-auto" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// Highest upgrade step an item has data for (9 for regular +0→+9 gear, 0 when craft-only).
function maxStepOf(itemId, pricing) {
  const steps = [pricing.itemMaterials, pricing.itemItems, pricing.itemYang]
    .flatMap(map => Object.keys(map[itemId] ?? {}).map(Number))
  return steps.length ? Math.max(...steps) : 0
}

export default function EquipmentBoard({ horizontal = false }) {
  const { t } = useTranslation()
  const [equipped, setEquipped] = useState(loadEquipped) // { slotId: { itemId, name, image, cells } }
  const [openSlot, setOpenSlot] = useState(null)
  const [itemsBySubcategory, setItemsBySubcategory] = useState({}) // { subcategoryName: [item] }
  const [itemsById, setItemsById] = useState({})
  const [pricing, setPricing] = useState(null) // everything computeItemPrice needs, once loaded
  const [mountParts, setMountParts] = useState(loadMountParts) // ticked MOUNT_PARTS keys
  const [chapterNames, setChapterNames] = useState({})
  const [materialsById, setMaterialsById] = useState({})
  const [mountIcon, setMountIcon] = useState(null)
  const [petBuild, setPetBuild] = useState(() => {
    try { return PET_BUILDS.find(b => b === localStorage.getItem(PET_KEY)) ?? null } catch { return null }
  })
  const [petSub, setPetSub] = useState(null) // the Pet subcategory: its icon + link target
  const { rawInputs, mode, setMode, manualOverrides } = usePriceBook()

  useEffect(() => {
    Promise.all([
      db.from('categories').select('id, name, sort_order').order('sort_order'),
      db.from('subcategories').select('id, name, image_url, category_id'),
      db.from('items').select('id, name, image_url, image_urls, category_id, subcategory_id, sort_order').order('sort_order'),
      db.from('material_materials').select('material_id, component_id, quantity').eq('variant', 1),
      db.from('materials').select('id, image_url, craft_yang_cost, no_price'),
      db.from('item_materials').select('item_id, material_id, quantity, step, variant'),
      db.from('item_items').select('item_id, component_item_id, quantity, step, variant'),
      db.from('item_step_yang').select('item_id, step, yang_cost, max_pity, variant'),
      db.from('materials').select('id, name').eq('is_upgrade_scroll', true).order('name'),
      fetchGlobalPrices(),
      db.from('settings').select('value').eq('key', MOUNT_ICON_SETTING).maybeSingle(),
    ]).then(([catRes, subRes, itemRes, recipeRes, matsRes, itemMatsRes, itemItemsRes, itemYangRes, scrollsRes, globalPrices, mountIconRes]) => {
      setMountIcon(mountIconRes.data?.value || null)
      setItemsById(Object.fromEntries((itemRes.data ?? []).map(i => [i.id, i])))
      setChapterNames(Object.fromEntries((catRes.data ?? []).map(c => [c.id, c.name])))
      setMaterialsById(Object.fromEntries((matsRes.data ?? []).map(m => [m.id, m])))
      setPricing({
        recipes: buildRecipeMap(recipeRes.data),
        yangCosts: buildYangCostMap(matsRes.data),
        noPriceIds: new Set((matsRes.data ?? []).filter(m => m.no_price).map(m => m.id)),
        itemMaterials: buildItemStepMap(itemMatsRes.data),
        itemItems: buildItemStepMap(itemItemsRes.data),
        itemYang: buildItemYangMap(itemYangRes.data),
        itemMaxPity: buildItemMaxPityMap(itemYangRes.data),
        defaultScrollByStep: buildDefaultScrollMap(scrollsForItem(null, scrollsRes.data ?? [])),
        itemCategoryById: Object.fromEntries((itemRes.data ?? []).map(i => [i.id, i.category_id])),
        globalPrices,
      })

      const categories = (catRes.data ?? []).filter(c => c.id !== PVP_CATEGORY_ID)
      const chapterOrder = Object.fromEntries(categories.map((c, i) => [c.id, i]))
      const chapterName = Object.fromEntries(categories.map(c => [c.id, c.name]))
      const subName = Object.fromEntries((subRes.data ?? []).map(s => [s.id, s.name]))
      setPetSub((subRes.data ?? []).find(isPetSubcategory) ?? null)
      const grouped = {}
      for (const item of itemRes.data ?? []) {
        if (!(item.category_id in chapterOrder) || itemImages(item).length === 0) continue
        const name = subName[item.subcategory_id]
        if (!name) continue
        ;(grouped[name] ??= []).push({ ...item, chapterName: chapterName[item.category_id] })
      }
      for (const list of Object.values(grouped)) {
        list.sort((a, b) => chapterOrder[b.category_id] - chapterOrder[a.category_id]) // newest chapter first
      }
      setItemsBySubcategory(grouped)
    })
  }, [])

  function update(next) {
    setEquipped(next)
    saveEquipped(next)
  }

  function equip(slot, item, image) {
    update({ ...equipped, [slot.id]: { itemId: item.id, name: item.name, image, cells: equipped[slot.id]?.image === image ? equipped[slot.id].cells : 1 } })
    setOpenSlot(null)
  }

  function clear(slot) {
    const next = { ...equipped }
    delete next[slot.id]
    update(next)
    setOpenSlot(null)
  }

  function setCells(slot, cells) {
    setEquipped(prev => {
      const cur = prev[slot.id]
      if (!cur || cur.cells === cells) return prev
      const next = { ...prev, [slot.id]: { ...cur, cells } }
      saveEquipped(next)
      return next
    })
  }

  async function changeMountIcon(url) {
    const prev = mountIcon
    setMountIcon(url)
    const { error } = await db.from('settings').upsert({ key: MOUNT_ICON_SETTING, value: url })
    if (error) {
      setMountIcon(prev)
      alert('Error: ' + error.message)
    }
  }

  function choosePet(build) {
    setPetBuild(build)
    try { build ? localStorage.setItem(PET_KEY, build) : localStorage.removeItem(PET_KEY) } catch { /* storage unavailable */ }
    setOpenSlot(null)
  }

  function toggleMountPart(key) {
    const next = mountParts.includes(key) ? mountParts.filter(k => k !== key) : [...mountParts, key]
    setMountParts(next)
    try { localStorage.setItem(MOUNT_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }

  const pickerSlot = SLOTS.find(s => s.id === openSlot)

  // Equipped items in board order, each priced like on its own item page
  // (saved scroll/seal/pity choices, or the defaults if never configured).
  let rows = []
  if (pricing) {
    const priceFn = makeMaterialPriceFn(mode, {
      rawInputs, globalPrices: pricing.globalPrices, recipes: pricing.recipes,
      yangCosts: pricing.yangCosts, manualOverrides, noPriceIds: pricing.noPriceIds,
    })
    const ctx = { ...pricing, materialPriceFn: priceFn, manualOverrides, rawInputs }
    for (const slot of SLOTS) {
      if (slot.pet) {
        if (!petBuild) continue
        // Priced like the Pet page's All tab after pressing the PvM / PvP preset,
        // on top of the user's own pet choices (evolutions, type, books...).
        const { mats, yang } = petPartCost('all', applyPetPreset(loadPetChoices(), petBuild))
        const petPriceFn = withPetDefaults(priceFn)
        rows.push({
          key: 'pet',
          image: petSub?.image_url,
          label: t(`pet.${petBuild}Pet`),
          to: petSub ? `/chapter/${petSub.category_id}/sub/${slugify(petSub.name)}?tab=all` : '#',
          price: yang + mats.reduce((sum, [id, qty]) => sum + petPriceFn(id) * qty, 0),
        })
        continue
      }
      if (slot.mount) {
        const mountChoices = loadMountChoices()
        for (const part of MOUNT_PARTS.filter(p => mountParts.includes(p.key))) {
          const { mats, yang } = mountPartCost(part.part, mountChoices)
          rows.push({
            key: `mount-${part.key}`,
            image: part.icon ?? materialsById[part.iconMat]?.image_url,
            label: part.label,
            to: `/chapter/${part.chapterId}/sub/${slugify(part.sub)}?tab=${part.part}`,
            price: yang + mats.reduce((sum, [id, qty]) => sum + priceFn(id) * qty, 0),
          })
        }
        continue
      }
      const item = itemsById[equipped[slot.id]?.itemId]
      if (!item) continue
      const maxStep = maxStepOf(item.id, pricing)
      rows.push({
        key: slot.id,
        image: equipped[slot.id].image,
        label: maxStep > 0 ? `${item.name} +${maxStep}` : item.name,
        to: `/chapter/${item.category_id}/item/${slugify(item.name)}`,
        price: computeItemPrice(item.id, ctx),
      })
    }
  }
  const total = rows.reduce((sum, r) => sum + r.price, 0)
  const panel = horizontal ? 'bg-black/30 border-white/10' : 'bg-gray-900 border-gray-700'

  return (
    <>
      <div className="relative w-full max-w-md mx-auto select-none" style={{ aspectRatio: `${BG_W} / ${BG_H}` }}>
        <img src="/equipment_bg.webp" alt="" draggable={false} className="absolute inset-0 w-full h-full rounded-lg" />
        {SLOTS.map(slot => {
          const equip = equipped[slot.id]
          const isOpen = openSlot === slot.id
          return (
            <button
              key={slot.id}
              type="button"
              aria-label={slot.id}
              title={equip?.name}
              onClick={() => (slot.subcategory || slot.mount || slot.pet) && setOpenSlot(slot.id)}
              className="group absolute cursor-pointer focus:outline-none"
              style={{
                left: `${(slot.x / BG_W) * 100}%`,
                top: `${(slot.y / BG_H) * 100}%`,
                width: `${(slot.w / BG_W) * 100}%`,
                height: `${(slot.h / BG_H) * 100}%`,
              }}
            >
              {equip && <SlotIcon slot={slot} equip={equip} onSize={cells => setCells(slot, cells)} />}
              {slot.mount && mountIcon && mountParts.length > 0 && <SlotOverlayIcon slot={slot} icon={mountIcon} />}
              {slot.pet && petBuild && petSub?.image_url && <SlotOverlayIcon slot={slot} icon={petSub.image_url} />}
              <svg viewBox={`0 0 ${slot.w} ${slot.h}`} className="absolute inset-0 w-full h-full overflow-visible">
                <polygon
                  points={outline(slot)}
                  fill="transparent"
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                  className={`transition-all duration-150 ${isOpen
                    ? 'stroke-yellow-400 [filter:drop-shadow(0_0_6px_rgba(250,204,21,0.9))]'
                    : 'stroke-transparent group-hover:stroke-yellow-300 group-hover:[filter:drop-shadow(0_0_5px_rgba(250,204,21,0.7))] group-focus-visible:stroke-yellow-300'}`}
                />
              </svg>
            </button>
          )
        })}
      </div>
      {/* Portalled: the vertical page's backdrop-blur card would otherwise trap the fixed modal. */}
      {pickerSlot?.pet && createPortal(
        <PetPicker selected={petBuild} onSelect={choosePet} onClose={() => setOpenSlot(null)} icon={petSub?.image_url} horizontal={horizontal} />,
        document.body,
      )}
      {pickerSlot?.mount && createPortal(
        <MountPicker
          selected={mountParts}
          onToggle={toggleMountPart}
          onClose={() => setOpenSlot(null)}
          chapterNames={chapterNames}
          materialsById={materialsById}
          icon={mountIcon}
          onIconChange={changeMountIcon}
          horizontal={horizontal}
        />,
        document.body,
      )}
      {pickerSlot?.subcategory && createPortal(
        <ItemPicker
          slot={pickerSlot}
          items={itemsBySubcategory[pickerSlot.subcategory] ?? []}
          current={equipped[pickerSlot.id]}
          onPick={(item, image) => equip(pickerSlot, item, image)}
          onClear={() => clear(pickerSlot)}
          onClose={() => setOpenSlot(null)}
          horizontal={horizontal}
        />,
        document.body,
      )}
      {rows.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-lg font-bold text-gray-100">{t('buildCalculator.equippedItems')}</h2>
            <PriceModeToggle mode={mode} setMode={setMode} horizontal={horizontal} />
          </div>
          <div className={`rounded-xl border divide-y divide-white/5 ${panel}`}>
            {rows.map(({ key, image, label, to, price }) => (
              <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                  {image && <img src={image} alt="" className="max-w-full max-h-full object-contain" />}
                </div>
                <Link to={to} className="flex-1 min-w-0 truncate text-sm text-gray-200 hover:text-yellow-400 transition-colors">
                  {label}
                </Link>
                <span className="text-yellow-400 text-sm font-mono shrink-0">{formatYang(price)}</span>
              </div>
            ))}
          </div>
          <div className={`mt-3 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${panel}`}>
            <span className="text-gray-300 font-semibold">{t('buildCalculator.grandTotal')}</span>
            <span className="text-2xl font-bold text-yellow-400 font-mono">{formatYang(total)}</span>
          </div>
        </div>
      )}
    </>
  )
}
