import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

// Renders a Cloudflare Turnstile challenge into `targetWindow` (defaults to
// the main window; pass the popped-out Picture-in-Picture window to render
// there instead - it's a separate document, so the script and the global
// `turnstile` object have to be loaded into that same window, not this one).
export default function TurnstileWidget({ onToken, targetWindow }) {
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
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
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
