import { useEffect } from 'react'
import { db } from '../dbClient'
import { getVisitorId } from '../utils/visitorId'

const PING_INTERVAL_MS = 60 * 1000

// Invisible — sends an anonymous heartbeat so VisitorStatsWidget can show admins
// how many people are using the site. Mounted once for every visitor in App.jsx.
export default function VisitorPing() {
  useEffect(() => {
    const visitorId = getVisitorId()
    if (!visitorId) return

    function ping() { db.rpc('ping_visitor', { visitor_id: visitorId }) }
    ping()
    const interval = setInterval(ping, PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return null
}
