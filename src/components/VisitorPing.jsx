import { useEffect } from 'react'
import { db } from '../dbClient'
import { getVisitorId } from '../utils/visitorId'

const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL
const PING_INTERVAL_MS = 20 * 1000

// Invisible — sends an anonymous heartbeat so VisitorStatsWidget can show admins
// how many people are using the site. Mounted once for every visitor in App.jsx.
export default function VisitorPing() {
  useEffect(() => {
    const visitorId = getVisitorId()
    if (!visitorId) return

    function ping() { db.rpc('ping_visitor', { visitor_id: visitorId }) }
    ping()
    const interval = setInterval(ping, PING_INTERVAL_MS)

    // Regular fetch() can get killed mid-flight when a tab closes/navigates away —
    // sendBeacon is designed to survive that, which is what lets "online now" drop
    // this visitor almost immediately instead of waiting out a stale heartbeat.
    function announceLeaving() {
      if (document.visibilityState !== 'hidden') return
      const body = new Blob([JSON.stringify({ visitor_id: visitorId, leaving: true })], { type: 'application/json' })
      navigator.sendBeacon?.(`${WORKER_URL}/rpc/ping_visitor`, body)
    }
    document.addEventListener('visibilitychange', announceLeaving)
    window.addEventListener('pagehide', announceLeaving)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', announceLeaving)
      window.removeEventListener('pagehide', announceLeaving)
    }
  }, [])

  return null
}
