// Client mirror of worker/src/links.js (keep both in sync): pre-check before sending, plus
// clickable rendering of the YouTube links the server lets through.

// Bare domains only match a curated TLD list (not any 2+ letter suffix), so chat typos
// like "ok.dzieki" or "1.5kk" don't trip it.
const LINK_RE = /(?:\b(?:https?|ftp):\/\/|\bhxxps?:\/\/|\bwww\.)[^\s]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|pl|eu|io|gg|ru|xyz|info|biz|cc|tk|ml|ga|cf|gq|top|site|online|shop|club|link|tv|ly|app|dev|click|live|page|cn|su|vip|store|fun|icu|ws)\b(?:[/:?#][^\s]*)?/gi

function isAllowedLink(token) {
  const rest = token.replace(/^(?:https?|ftp|hxxps?):\/\//i, '')
  const host = rest.match(/^[^/?#:\s]*/)[0].replace(/\.+$/, '').toLowerCase()
  if (host.includes('@')) return false
  const okHost = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com'
  if (!okHost) return false
  // YouTube's own redirect endpoints (and any URL smuggled inside a URL) would let a
  // third-party link ride on an allowed host.
  const tail = rest.slice(host.length)
  return !/redirect|attribution_link|\/url\?|:\/\/|%3a%2f%2f|%2f%2f/i.test(tail)
}

function hasDisallowedLink(text) {
  if (!text) return false
  const matches = String(text).match(LINK_RE)
  return !!matches && matches.some(m => !isAllowedLink(m))
}

export { hasDisallowedLink }

// Splits text into plain and YouTube-link segments so the caller can render the links as
// anchors. Anything link-like that isn't allowed stays plain, unclickable text.
export function splitLinks(text) {
  const str = String(text)
  const parts = []
  let last = 0
  for (const m of str.matchAll(LINK_RE)) {
    if (!isAllowedLink(m[0])) continue
    // trailing punctuation belongs to the sentence, not the URL
    const url = m[0].replace(/[.,;:!?)\]]+$/, '')
    if (m.index > last) parts.push({ text: str.slice(last, m.index) })
    parts.push({ url: /^https?:\/\//i.test(url) ? url : 'https://' + url, text: url })
    last = m.index + url.length
  }
  if (last < str.length) parts.push({ text: str.slice(last) })
  return parts
}
