// Service worker for /dogtracker Web Push notifications only. The page
// subscribes only while it's mounted (see DogTracker.jsx) and unsubscribes
// when it unmounts, so a push simply never gets sent to this browser while
// dogtracker isn't open - no system notification logic needed here at all,
// just relay to whichever open tab(s) actually have it loaded.
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      if (client.url.indexOf('/dogtracker') !== -1) client.postMessage({ type: 'dogtracker-push', payload: data })
    }
  })())
})
