// Admin-only named circles on the Ore Finder maps (table ore_finder_zones,
// admin-read-only on the server). Never rendered for regular users.

export const DEFAULT_ZONE_RADIUS = 3 // % of the map width
export const MIN_ZONE_RADIUS = 0.5
export const MAX_ZONE_RADIUS = 20

// Circles drawn over the map. Dragging a circle moves it (reported as % of the map).
export function OreFinderZonesLayer({ zones, selectedId, onSelect, onDragStart }) {
  return zones.map(zone => {
    const selected = zone.id === selectedId
    return (
      <div
        key={zone.id}
        onPointerDown={e => { e.stopPropagation(); onSelect(zone.id); onDragStart(zone.id, e) }}
        onClick={e => e.stopPropagation()}
        className={`absolute z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full aspect-square bg-red-500/30 border-2 cursor-move touch-none ${selected ? 'border-yellow-300 ring-2 ring-yellow-300/60' : 'border-red-500'}`}
        style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.r * 2}%` }}
      >
        {zone.name && (
          <span className="absolute left-1/2 bottom-full -translate-x-1/2 mb-0.5 text-[10px] font-bold text-white bg-black/70 rounded px-1 whitespace-nowrap pointer-events-none">
            {zone.name}
          </span>
        )}
      </div>
    )
  })
}

// Editor for the selected circle: name, size, delete.
export function OreFinderZonePanel({ zone, onChange, onDelete, onClose }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3">
      <input
        value={zone.name ?? ''}
        onChange={e => onChange({ name: e.target.value })}
        placeholder="Circle name"
        maxLength={60}
        className="flex-1 min-w-[10rem] bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-400"
      />
      <label className="flex items-center gap-2 text-xs text-gray-400">
        Size
        <input
          type="range"
          min={MIN_ZONE_RADIUS}
          max={MAX_ZONE_RADIUS}
          step={0.1}
          value={zone.r}
          onChange={e => onChange({ r: Number(e.target.value) })}
          className="w-40 accent-red-500"
        />
      </label>
      <button type="button" onClick={onDelete} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-300 border border-red-400/40 hover:bg-red-500/10">
        Delete
      </button>
      <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-800 border border-gray-600 text-gray-200 hover:bg-gray-700">
        Done
      </button>
    </div>
  )
}
