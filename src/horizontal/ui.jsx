import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatYang } from '../utils/formatYang'
import { FIXED_MATERIAL_PRICES } from '../utils/priceBook'
import { rawItemName } from '../utils/itemName'
import { slugify } from '../utils/slug'
import MaterialPriceCell from '../components/MaterialPriceCell'

// Shared building blocks for the horizontal design. Every "H" page composes
// these instead of the vertical site's Tile/card components — a separate,
// self-contained visual language rather than a reskin of the old one.

export function PageHeader({ title, actions }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
      <h1 className="text-xl font-bold text-gray-100 tracking-tight">{title}</h1>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function Panel({ children, className = '' }) {
  return <div className={`rounded-xl border border-white/10 bg-black/20 ${className}`}>{children}</div>
}

export function RowList({ children, className = '' }) {
  return <div className={`rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden bg-black/20 ${className}`}>{children}</div>
}

export function EmptyState({ emoji, text }) {
  return (
    <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
      <span className="text-5xl">{emoji}</span>
      <p className="text-sm">{text}</p>
    </div>
  )
}

export function PillButton({ active, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active ? 'bg-yellow-400 text-gray-950' : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300'
      } ${props.className ?? ''}`}
    />
  )
}

// Windows-Explorer-style view switch: "list" (full-width banded rows) or
// "grid" (compact tiles). Persisted per page via a storage key.
export function useViewMode(key, defaultView = 'list') {
  const storageKey = `h_view_${key}`
  const [view, setViewState] = useState(() => {
    try { return localStorage.getItem(storageKey) || defaultView } catch { return defaultView }
  })
  function setView(v) {
    setViewState(v)
    try { localStorage.setItem(storageKey, v) } catch { /* private mode etc. */ }
  }
  return [view, setView]
}

export function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center bg-black/30 border border-white/10 rounded-lg overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange('list')}
        title="Lista"
        className={`w-8 h-8 flex items-center justify-center text-sm transition-colors ${view === 'list' ? 'bg-yellow-400 text-gray-950' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
      >
        ☰
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        title="Kafelki"
        className={`w-8 h-8 flex items-center justify-center text-sm transition-colors ${view === 'grid' ? 'bg-yellow-400 text-gray-950' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
      >
        ▦
      </button>
    </div>
  )
}

// One full-width banded row: icon | label(+sublabel) | children (tags/price/etc,
// flows in the middle) | admin controls | chevron. Used by every "list view" page.
export function Row({ to, onClick, image, emoji, label, sublabel, dashed, blocked, onEdit, onToggleMaintenance, maintenance, hidden, onToggleHidden, reorder, children }) {
  const { t } = useTranslation()
  const inner = (
    <>
      {reorder && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); reorder.onUp() }} disabled={reorder.disableUp}
            className="w-5 h-5 flex items-center justify-center rounded bg-black/30 border border-white/10 text-gray-400 hover:text-yellow-400 disabled:opacity-20 text-[10px] leading-none transition-colors">▲</button>
          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); reorder.onDown() }} disabled={reorder.disableDown}
            className="w-5 h-5 flex items-center justify-center rounded bg-black/30 border border-white/10 text-gray-400 hover:text-yellow-400 disabled:opacity-20 text-[10px] leading-none transition-colors">▼</button>
        </div>
      )}
      <div className="w-11 h-11 shrink-0 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center overflow-hidden">
        {image ? <img src={image} alt={label} loading="lazy" className="w-8 h-8 object-contain" /> : <span className="text-xl">{emoji}</span>}
      </div>
      <div className={`flex flex-col min-w-0 ${children ? 'shrink-0 w-40' : 'flex-1'}`}>
        <span className={`truncate text-sm font-semibold ${dashed ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-100'}`}>{label}</span>
        {sublabel && <span className="truncate text-xs text-gray-500">{sublabel}</span>}
      </div>
      {children && <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">{children}</div>}
      {maintenance && (
        <span className="shrink-0 text-[11px] font-bold text-yellow-400 bg-black/40 border border-yellow-400/30 px-2 py-1 rounded-full">
          🚧 {t('common.inProgress')}
        </span>
      )}
      {maintenance && hidden && (
        <span className="shrink-0 text-[11px] font-bold text-gray-300 bg-black/40 border border-white/20 px-2 py-1 rounded-full">🙈 Hidden</span>
      )}
      {onToggleMaintenance && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleMaintenance() }}
          className={`shrink-0 text-[11px] px-1.5 py-1 rounded-full border transition-colors ${maintenance ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-black/30 border-white/10 text-gray-400 hover:text-yellow-400'}`}>
          🚧
        </button>
      )}
      {maintenance && onToggleHidden && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleHidden() }}
          title={hidden ? 'Hidden from users while in progress — click to show' : 'Visible to users while in progress — click to hide'}
          className={`shrink-0 text-[11px] px-1.5 py-1 rounded-full border transition-colors ${hidden ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-black/30 border-white/10 text-gray-400 hover:text-yellow-400'}`}>
          {hidden ? '🙈' : '👁'}
        </button>
      )}
      {onEdit && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
          className="shrink-0 text-gray-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all">
          ✏️
        </button>
      )}
      {!blocked && <span className="shrink-0 text-gray-600 group-hover:text-yellow-400 group-hover:translate-x-0.5 transition-all">›</span>}
    </>
  )

  const cls = `group relative flex items-center gap-4 px-5 py-3 transition-colors odd:bg-white/[0.02] ${
    dashed ? 'border-l-2 border-dashed border-yellow-900/40' : ''
  } ${blocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-yellow-400/[0.05]'}`

  if (blocked) return <div className={cls}>{inner}</div>
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>{inner}</button>
  return <Link to={to} className={cls}>{inner}</Link>
}

// Compact square tile for "grid view" — same data, denser browsing.
export function GridTile({ to, onClick, image, emoji, label, dashed, blocked, onEdit, maintenance, onToggleMaintenance, hidden, onToggleHidden }) {
  const inner = (
    <>
      <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-black/30 border border-white/5">
        {image ? <img src={image} alt={label} loading="lazy" className="w-9 h-9 object-contain" /> : <span className="text-2xl">{emoji}</span>}
      </div>
      <span className={`text-xs font-semibold text-center leading-tight line-clamp-2 ${dashed ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-200'}`}>{label}</span>
      {maintenance && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl pointer-events-none">
          <span className="text-[10px] font-bold text-yellow-400 bg-[#14110d] border border-yellow-400/40 px-1.5 py-0.5 rounded-full">🚧{hidden && ' 🙈'}</span>
        </span>
      )}
      {onToggleMaintenance && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleMaintenance() }}
          className={`absolute bottom-1.5 right-1.5 text-[10px] px-1 py-0.5 rounded-full border transition-colors z-10 ${maintenance ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-black/50 border-white/10 text-gray-300 hover:text-yellow-400'}`}>
          🚧
        </button>
      )}
      {maintenance && onToggleHidden && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleHidden() }}
          title={hidden ? 'Hidden from users while in progress — click to show' : 'Visible to users while in progress — click to hide'}
          className={`absolute bottom-1.5 left-1.5 text-[10px] px-1 py-0.5 rounded-full border transition-colors z-10 ${hidden ? 'bg-yellow-400 text-gray-950 border-yellow-400' : 'bg-black/50 border-white/10 text-gray-300 hover:text-yellow-400'}`}>
          {hidden ? '🙈' : '👁'}
        </button>
      )}
      {onEdit && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
          className="absolute top-1.5 right-1.5 text-gray-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-sm z-10">
          ✏️
        </button>
      )}
    </>
  )
  const cls = `group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-3 aspect-square transition-colors ${
    dashed ? 'border-dashed border-white/15 hover:border-yellow-400/40' : 'border-white/10 bg-black/20 hover:bg-yellow-400/[0.06] hover:border-yellow-400/30'
  } ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`

  if (blocked) return <div className={cls}>{inner}</div>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  return <Link to={to} className={cls}>{inner}</Link>
}

export function GridWrap({ children }) {
  return <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">{children}</div>
}

// Icon with its quantity as a small badge on the corner, price sitting right
// underneath — no bounding box around the material itself, so a row of many
// materials reads as a loose row of icons (like a game inventory bar) rather
// than a strip of bordered chips. The badge is a rounded square in the site's
// own amber, not a circle, and there's no counter/stepper look-alike here —
// just enough to keep it feeling like this site, not a copy of the reference.
export function MatTag({ mat, quantity, unitPrice, rawValue, onPriceChange, kind, globalMode, manualOverrides, onToggleManualOverride, hidePrice }) {
  const { t } = useTranslation()
  const manualOverride = manualOverrides?.has(mat.id) ?? false
  const canOverride = !hidePrice && !mat.no_price && !FIXED_MATERIAL_PRICES[mat.id] && !!onToggleManualOverride
  const to = kind === 'item' ? `/chapter/${mat.category_id}/item/${slugify(rawItemName(mat))}` : `/materials/${slugify(mat.name)}`
  const title = hidePrice ? `${mat.name} ×${quantity}` : `${mat.name} ×${quantity} — ${formatYang(unitPrice * quantity)}`
  return (
    <div className="group flex flex-col items-center gap-1 shrink-0" title={title}>
      <Link to={to} className="relative w-10 h-10 flex items-center justify-center rounded-lg bg-black/25 hover:bg-black/40 transition-colors">
        {mat.image_url
          ? <img src={mat.image_url} alt={mat.name} className="w-7 h-7 object-contain" />
          : <span className="text-sm">{kind === 'item' ? '⚔️' : '🧪'}</span>}
        <span className="absolute -bottom-1 -right-1 bg-black/85 text-amber-300 text-[10px] font-bold rounded px-1 leading-tight">
          {quantity}
        </span>
        {canOverride && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleManualOverride(mat.id) }}
            title={t('materials.manualPrice')}
            className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full text-[8px] leading-none flex items-center justify-center transition-colors ${
              manualOverride ? 'bg-yellow-400 text-gray-950' : 'bg-black/70 text-transparent group-hover:text-gray-400'
            }`}
          >
            ✓
          </button>
        )}
      </Link>
      {!hidePrice && (
        <MaterialPriceCell
          material={mat}
          rawValue={rawValue}
          computedValue={unitPrice}
          onPriceChange={onPriceChange}
          computed={manualOverride ? false : (kind === 'item' || globalMode ? true : undefined)}
          manualOverride={manualOverride}
          allowGlobalSubmit={kind !== 'item'}
          bare
        />
      )}
    </div>
  )
}

// Fail-count stepper: round −/+ buttons flank a bare number, no bordered
// pill or divider lines around them, so it doesn't read as a lifted UI
// pattern from anywhere else — just two small round buttons and a digit.
export function PityStepper({ value, max, onChange, title }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0" title={title}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-6 h-6 rounded-full bg-black/30 border border-white/10 hover:border-yellow-400/40 hover:text-yellow-300 text-gray-400 text-sm leading-none flex items-center justify-center transition-colors"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-mono text-gray-200">{value}</span>
      <button
        type="button"
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        className="w-6 h-6 rounded-full bg-black/30 border border-white/10 hover:border-yellow-400/40 hover:text-yellow-300 text-gray-400 text-sm leading-none flex items-center justify-center transition-colors"
      >
        +
      </button>
    </div>
  )
}

// Shared by ScrollPicker/SealPicker: rows near the bottom of a long list
// don't have 13rem (max-h-52) of room below them before hitting the footer —
// this checks the trigger's actual position each time it opens and flips the
// panel to open upward when there isn't enough space underneath.
export function useDropUp(ref, open) {
  const [up, setUp] = useState(false)
  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setUp(spaceBelow < 224 && rect.top > spaceBelow)
  }, [open, ref])
  return up
}

// Same dropdown-button look as SealPicker (which single-selects too, just for
// a different list) — the plain <select> next to it looked out of place once
// SealPicker got its own styled panel.
export function ScrollPicker({ scrolls, value, onChange }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const openUp = useDropUp(ref, open)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = scrolls.find(s => s.id === value)
  const isMagic = selected?.name.toLowerCase().includes('magic stone')
  const label = selected ? (isMagic ? `⭐ ${selected.name}` : selected.name) : t('itemDetail.noScroll')

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-9 bg-black/20 border border-white/10 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-yellow-400 flex items-center gap-1"
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <span className="text-gray-500 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={`absolute left-0 z-50 bg-[#1c1712] border border-white/10 rounded-lg shadow-xl min-w-40 max-h-52 overflow-y-auto py-1 ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
          >
            {t('itemDetail.noScroll')}
          </button>
          {scrolls.map(s => {
            const magic = s.name.toLowerCase().includes('magic stone')
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { onChange(s.id); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
              >
                {magic ? `⭐ ${s.name}` : s.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
