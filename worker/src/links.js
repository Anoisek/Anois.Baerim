// Link filter for public free-text fields (map notes, ore comments, guide suggestions).
// Any link is rejected except YouTube. Mirrored 1:1 by src/utils/linkFilter.js on the
// client (pre-check + clickable YouTube links) - keep both in sync.

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

const LINKS_NOT_ALLOWED = 'links are not allowed (only YouTube links)'

export { hasDisallowedLink, LINKS_NOT_ALLOWED }
