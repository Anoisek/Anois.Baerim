// Minimal Web Push sender: RFC 8291 message encryption + RFC 8292 VAPID auth,
// built only on the Workers runtime's Web Crypto API. The `web-push` npm
// package depends on Node's crypto module and doesn't run in this runtime,
// so this reimplements just the pieces dogtracker actually needs.

const PUSH_TTL_SECONDS = 3600 // dog sightings are stale long before this matters
const RECORD_SIZE = 4096

function toBase64Url(bytes) {
  let binary = ''
  const view = new Uint8Array(bytes)
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) { out.set(p, offset); offset += p.length }
  return out
}

async function signVapidJwt(privateKeyJwk, audience, subject) {
  const enc = new TextEncoder()
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }
  const signingInput = toBase64Url(enc.encode(JSON.stringify(header))) + '.' + toBase64Url(enc.encode(JSON.stringify(payload)))

  const key = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput))
  return signingInput + '.' + toBase64Url(signature)
}

// RFC 8291: derive a content-encryption key and nonce from an ECDH exchange
// with the subscriber's key, then encrypt as a single aes128gcm record
// (RFC 8188) - our payloads are tiny, so one record is always enough.
async function encryptPayload(payloadObj, subscription) {
  const enc = new TextEncoder()
  const plaintext = enc.encode(JSON.stringify(payloadObj))

  const uaPublicKeyBytes = fromBase64Url(subscription.p256dh)
  const authSecret = fromBase64Url(subscription.auth)

  const uaPublicKey = await crypto.subtle.importKey('raw', uaPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  const ephemeralKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey))

  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, ephemeralKeyPair.privateKey, 256)

  const keyInfo = concatBytes(enc.encode('WebPush: info\0'), uaPublicKeyBytes, asPublicKeyBytes)
  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits'])
  const ikm = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo }, ikmKey, 256)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const ikmKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') }, ikmKey2, 128)
  const nonce = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') }, ikmKey2, 96)

  const padded = concatBytes(plaintext, new Uint8Array([0x02])) // delimiter: last (only) record
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded))

  const header = new Uint8Array(16 + 4 + 1 + 65)
  header.set(new Uint8Array(salt), 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false)
  header[20] = 65
  header.set(asPublicKeyBytes, 21)

  return concatBytes(header, ciphertext)
}

async function sendWebPush(env, subscription, payloadObj) {
  const body = await encryptPayload(payloadObj, subscription)
  const audience = new URL(subscription.endpoint).origin
  const privateKeyJwk = JSON.parse(env.VAPID_PRIVATE_KEY_JWK)
  const jwt = await signVapidJwt(privateKeyJwk, audience, env.VAPID_SUBJECT)

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: String(PUSH_TTL_SECONDS),
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    },
    body,
  })
}

// Fire-and-forget to every stored subscription; a subscription the browser
// has since dropped (gone/expired) reports 404/410 and gets cleaned up here.
async function broadcastToAll(env, payloadObj) {
  if (!env.VAPID_PRIVATE_KEY_JWK) return
  const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM dogtracker_push_subscriptions').all()
  await Promise.allSettled(results.map(async sub => {
    try {
      const res = await sendWebPush(env, sub, payloadObj)
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare('DELETE FROM dogtracker_push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
      } else if (!res.ok) {
        console.log('dogtracker push send failed', sub.endpoint.slice(-12), res.status)
      }
    } catch (err) {
      console.log('dogtracker push send error', sub.endpoint.slice(-12), err && err.message)
    }
  }))
}

export { broadcastToAll }
