import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

// Renders a Cloudflare Turnstile challenge into `targetWindow` (defaults to
// the main window). Turnstile's anti-bot checks fail when rendered inside a
// Document Picture-in-Picture window (it's an auxiliary browsing context,
// not a normal top-level one) - always render into the real page window and
// hand the resulting token to whatever needs it instead.
//
// `autoRenew` keeps a token continuously available: on expiry/error it resets
// the widget in place rather than just clearing the token, so a caller that
// polls a token prop (e.g. the PiP flow, which can't show this widget itself)
// gets a fresh one without the widget disappearing.
export default function TurnstileWidget({ onToken, targetWindow, autoRenew }) {
  const win = targetWindow || (typeof window !== 'undefined' ? window : null)
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    if (!SITE_KEY || !win) return
    let cancelled = false

    function render() {
      if (cancelled || !containerRef.current) return
      widgetIdRef.current = win.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: 'dark',
        callback: onToken,
        'expired-callback': () => {
          onToken('')
          if (autoRenew) win.turnstile.reset(widgetIdRef.current)
        },
        'error-callback': () => {
          onToken('')
          if (autoRenew) win.turnstile.reset(widgetIdRef.current)
        },
      })
    }

    if (win.turnstile) {
      render()
    } else {
      const doc = win.document
      let script = doc.querySelector('script[data-turnstile]')
      if (!script) {
        script = doc.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
        script.async = true
        script.defer = true
        script.setAttribute('data-turnstile', '1')
        doc.head.appendChild(script)
      }
      script.addEventListener('load', render, { once: true })
    }

    return () => {
      cancelled = true
      if (widgetIdRef.current != null && win.turnstile) {
        try { win.turnstile.remove(widgetIdRef.current) } catch {
          // widget/window may already be gone
        }
      }
    }
  }, [win])

  if (!SITE_KEY) return null
  return <div ref={containerRef} />
}
