import { useEffect, useState } from 'react'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'

const REFRESH_INTERVAL_MS = 30 * 1000

export default function VisitorStatsWidget() {
  const { isAdmin } = useAuth()
  const [stats, setStats] = useState(null)

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

  return (
    <div className="fixed top-20 right-4 z-40 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-4 py-3 text-xs shadow-lg pointer-events-none select-none">
      <div className="font-bold text-yellow-400 mb-1.5 whitespace-nowrap">👥 {stats.online} online now</div>
      <div className="flex flex-col gap-0.5 text-gray-400 whitespace-nowrap">
        <div>Today: <span className="text-gray-100 font-semibold">{stats.day}</span></div>
        <div>This week: <span className="text-gray-100 font-semibold">{stats.week}</span></div>
        <div>This month: <span className="text-gray-100 font-semibold">{stats.month}</span></div>
        <div>All-time: <span className="text-gray-100 font-semibold">{stats.overall}</span></div>
      </div>
    </div>
  )
}
