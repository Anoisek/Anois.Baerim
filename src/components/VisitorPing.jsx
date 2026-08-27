import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { db } from '../dbClient'
import { visitorIdPromise } from '../utils/visitorId'

const WORKER_URL = import.meta.env.VITE_IMAGES_WORKER_URL
const PING_INTERVAL_MS = 20 * 1000

// Invisible — sends an anonymous heartbeat (plus which page it's on) so
// VisitorStatsWidget can show admins how many people are using the site and
// where. Mounted once for every visitor in App.jsx.
export default function VisitorPing() {
  const location = useLocation()
  // Read via ref inside the heartbeat so the interval isn't torn down and
  // restarted on every navigation — only the immediate on-navigation ping
  // below needs pathname as an effect dependency.
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  useEffect(() => {
    let cancelled = false
    let interval = null
    let announceLeaving = null

    visitorIdPromise.then(visitorId => {
      if (cancelled || !visitorId) return

      function ping() { db.rpc('ping_visitor', { visitor_id: visitorId, page: pathnameRef.current }) }
      ping()
      interval = setInterval(ping, PING_INTERVAL_MS)

      // Regular fetch() can get killed mid-flight when a tab closes/navigates away —
      // sendBeacon is designed to survive that, which is what lets "online now" drop
      // this visitor almost immediately instead of waiting out a stale heartbeat.
      announceLeaving = function () {
        if (document.visibilityState !== 'hidden') return
        const body = new Blob([JSON.stringify({ visitor_id: visitorId, leaving: true, page: pathnameRef.current })], { type: 'application/json' })
        navigator.sendBeacon?.(`${WORKER_URL}/rpc/ping_visitor`, body)
      }
      document.addEventListener('visibilitychange', announceLeaving)
      window.addEventListener('pagehide', announceLeaving)
    })

    return () => {
      cancelled = true
      clearInterval(interval)
      if (announceLeaving) {
        document.removeEventListener('visibilitychange', announceLeaving)
        window.removeEventListener('pagehide', announceLeaving)
      }
    }
  }, [])

  // Pings immediately on navigation so the admin's per-page breakdown updates
  // without waiting up to 20s for the next regular heartbeat.
  useEffect(() => {
    visitorIdPromise.then(visitorId => {
      if (!visitorId) return
      db.rpc('ping_visitor', { visitor_id: visitorId, page: location.pathname })
    })
  }, [location.pathname])

  return null
}
