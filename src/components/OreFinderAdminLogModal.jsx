import { useEffect, useState } from 'react'
import { db } from '../dbClient'

function formatTime(iso) {
  return new Date(iso).toLocaleString()
}

// Admin-only moderation tool: who reported what, when, from which IP - and a
// one-click block/unblock so a deliberate troll can be cut off from
// reporting again. Not translated (same convention as DogTracker's UI) -
// this is Bartek's own tooling, never shown to regular visitors.
export default function OreFinderAdminLogModal({ maps, onClose }) {
  const [logs, setLogs] = useState([])
  const [blockedIps, setBlockedIps] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      db.from('ore_finder_report_log').select('*').order('created_at', { ascending: false }).limit(200),
      db.from('ore_finder_blocked_ips').select('*'),
    ]).then(([logRes, blockedRes]) => {
      setLogs(logRes.data ?? [])
      const map = {}
      for (const row of blockedRes.data ?? []) map[row.ip] = true
      setBlockedIps(map)
      setLoading(false)
    })
  }, [])

  async function handleBlock(ip) {
    setBlockedIps(prev => ({ ...prev, [ip]: true }))
    await db.from('ore_finder_blocked_ips').insert({ ip })
  }

  async function handleUnblock(ip) {
    setBlockedIps(prev => {
      const next = { ...prev }
      delete next[ip]
      return next
    })
    await db.from('ore_finder_blocked_ips').delete().eq('ip', ip)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl flex flex-col gap-4 shadow-xl shadow-black/50 max-h-[85vh]"
      >
        <div className="flex items-center justify-between">
          <p className="text-xl font-extrabold text-yellow-400 tracking-wide">🛡️ Report log (admin)</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500">No reports logged yet.</p>
        ) : (
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="text-gray-400 sticky top-0 bg-gray-900">
                <tr>
                  <th className="py-1.5 pr-3">Time</th>
                  <th className="py-1.5 pr-3">Map</th>
                  <th className="py-1.5 pr-3">Coords</th>
                  <th className="py-1.5 pr-3">Comment</th>
                  <th className="py-1.5 pr-3">IP</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {logs.map(row => {
                  const blocked = !!blockedIps[row.ip]
                  const map = maps.find(m => m.name === row.map)
                  const px = map ? Math.round((row.x / 100) * map.width) : Math.round(row.x)
                  const py = map ? Math.round((row.y / 100) * map.height) : Math.round(row.y)
                  return (
                    <tr key={row.id} className="border-t border-gray-800 text-gray-200 align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{formatTime(row.created_at)}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{row.map}</td>
                      <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{px}, {py}</td>
                      <td className="py-1.5 pr-3 max-w-[160px] truncate" title={row.comment || ''}>
                        {row.comment || '—'}
                      </td>
                      <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{row.ip || '—'}</td>
                      <td className="py-1.5 whitespace-nowrap">
                        {row.ip && (
                          blocked ? (
                            <button
                              onClick={() => handleUnblock(row.ip)}
                              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 text-[11px] transition-colors"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlock(row.ip)}
                              className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] transition-colors"
                            >
                              Block
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
