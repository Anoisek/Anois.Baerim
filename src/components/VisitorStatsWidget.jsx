import { useEffect, useState } from 'react'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'

const REFRESH_INTERVAL_MS = 30 * 1000

// Mirrors the routes in App.jsx, collapsing dynamic segments (:itemId etc.) into
// one friendly label per feature — keep in sync if routes change.
function pageLabel(path) {
  if (!path || path === '?') return 'Unknown'
  if (path === '/') return 'Home'
  if (path === '/login') return 'Login'
  if (path === '/systems') return 'Systems'
  if (path.startsWith('/systems/interactive-map')) return 'Interactive Map'
  if (path.startsWith('/systems/exploration')) return 'Exploration'
  if (path.startsWith('/systems/metin-calculator')) return 'Metin Calculator'
  if (path.startsWith('/systems/color-system')) return 'Color System'
  if (path.startsWith('/systems/bonuses')) return 'Bonuses'
  if (path.startsWith('/buildcalculator')) return 'Build Calculator'
  if (path.startsWith('/materials')) return 'Materials'
  if (path.startsWith('/chapter/') && path.includes('/item/')) return 'Item Calculator'
  if (path.startsWith('/chapter/')) return 'Chapters'
  if (path.startsWith('/items/')) return 'Material Usage'
  if (path === '/privacy-policy') return 'Privacy Policy'
  if (path === '/suggestions') return 'Suggestions'
  return path
}

export default function VisitorStatsWidget() {
  const { isAdmin } = useAuth()
  const [stats, setStats] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    function load() {
      db.rpc('visitor_stats').then(({ data }) => { if (!cancelled && data) setStats(data) })
    }
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isAdmin])

  if (!isAdmin || !stats) return null

  // Server groups by exact path (e.g. one row per specific map slug under
  // /systems/interactive-map), so several different rows can share the same
  // friendly label here — merge those into one summed line instead of showing
  // "Interactive Map" six times over.
  const grouped = new Map()
  for (const { page, count } of stats.byPage) {
    const label = pageLabel(page)
    grouped.set(label, (grouped.get(label) || 0) + count)
  }
  const groupedEntries = [...grouped.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="fixed top-20 right-4 z-40 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-4 py-3 text-xs shadow-lg select-none max-w-[14rem]">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="font-bold text-yellow-400 mb-1.5 whitespace-nowrap flex items-center gap-1.5 w-full text-left"
      >
        👥 {stats.online} online now
        <span className="text-gray-500 text-[10px] ml-auto">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-0.5 border-t border-gray-700 pt-1.5 mb-1.5">
          {groupedEntries.length === 0 ? (
            <div className="text-gray-500">Nobody online.</div>
          ) : (
            groupedEntries.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-gray-300">
                <span className="truncate">{label}</span>
                <span className="font-semibold text-gray-100 shrink-0">{count}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex flex-col gap-0.5 text-gray-400 whitespace-nowrap pt-1.5 border-t border-gray-700">
        <div>Today: <span className="text-gray-100 font-semibold">{stats.day}</span></div>
        <div>This week: <span className="text-gray-100 font-semibold">{stats.week}</span></div>
        <div>This month: <span className="text-gray-100 font-semibold">{stats.month}</span></div>
        <div>All-time: <span className="text-gray-100 font-semibold">{stats.overall}</span></div>
      </div>
    </div>
  )
}
