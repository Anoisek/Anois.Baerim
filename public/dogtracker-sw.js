// Service worker for /dogtracker Web Push notifications only. A push event
// fires here even while the tab is open - if the page is actually visible,
// we just message it directly (it plays its own beep and refetches) instead
// of also popping a system notification on top of what the user is already
// looking at. Only show the OS notification when nobody has it open/visible.
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    let hasVisible = false
    for (const client of allClients) {
      client.postMessage({ type: 'dogtracker-push', payload: data })
      if (client.visibilityState === 'visible') hasVisible = true
    }
    if (!hasVisible) {
      await self.registration.showNotification('DOG TRACKER', {
        body: 'Zgłoszono nowego psa.',
        icon: '/small_logo.png',
        tag: 'dogtracker-dog',
      })
    }
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      if (client.url.indexOf('/dogtracker') !== -1 && 'focus' in client) return client.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow('/dogtracker')
    return undefined
  })())
})
