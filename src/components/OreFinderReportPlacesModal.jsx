import { useEffect, useState } from 'react'
import { db } from '../dbClient'

const MAP_COLORS = { Yongan: 'red', Joan: 'yellow', Pyungmoo: 'blue' }

// Read-only view of the named circles ("report places") people can use in
// "@Ore Finder <place>" reports - one tab per Ore Finder map.
export default function OreFinderReportPlacesModal({ maps, onClose, t }) {
  const [zones, setZones] = useState([])
  const [selected, setSelected] = useState(maps[0]?.name ?? null)
  const map = maps.find(m => m.name === selected)
  const zonesOnMap = zones.filter(z => z.map === selected)

  useEffect(() => {
    db.from('ore_finder_zones').select('map, x, y, r, name').then(({ data }) => setZones(data ?? []))
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-2xl flex flex-col gap-4 shadow-xl shadow-black/50 max-h-[90vh] overflow-y-auto"
      >
        <p className="text-xl font-extrabold text-yellow-400 tracking-wide">{t('oreFinder.reportPlacesTitle')}</p>

        <div className="flex flex-wrap gap-2">
          {maps.map(m => (
            <button
              key={m.name}
              type="button"
              onClick={() => setSelected(m.name)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                selected === m.name ? 'bg-yellow-400 border-yellow-400 text-gray-950' : 'bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200'
              }`}
            >
              {m.name} ({MAP_COLORS[m.name] ?? m.name})
            </button>
          ))}
        </div>

        {map && (
          <div className="relative w-full shrink-0 rounded-xl border border-gray-700 overflow-hidden" style={{ aspectRatio: `${map.width} / ${map.height}` }}>
            <img src={map.image_url} alt={map.name} draggable="false" className="w-full h-full object-contain select-none" />
            {zonesOnMap.map(zone => (
              <div
                key={`${zone.name}-${zone.x}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full aspect-square bg-red-500/30 border-2 border-red-500 pointer-events-none"
                style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.r * 2}%` }}
              >
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold text-white bg-black/75 rounded px-1.5 py-0.5 whitespace-nowrap">
                  {zone.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {zonesOnMap.length > 0 && (
          <p className="text-sm text-gray-300">
            {t('oreFinder.reportPlacesHint')}{' '}
            <code className="bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-yellow-300 font-mono text-xs">@Ore Finder {zonesOnMap[0].name.toLowerCase()}</code>
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 text-gray-950 transition-colors"
        >
          {t('oreFinder.guideCloseButton')}
        </button>
      </div>
    </div>
  )
}
