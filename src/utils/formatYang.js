export function parseYang(str) {
  if (str === '' || str == null) return ''
  const s = str.toString().trim().toLowerCase()
  const match = s.match(/^(\d+(?:[.,]\d+)?)(k{1,3})?$/)
  if (!match) return ''
  const num = parseFloat(match[1].replace(',', '.'))
  const suffix = match[2] ?? ''
  switch (suffix) {
    case 'kkk': return Math.round(num * 1_000_000_000)
    case 'kk':  return Math.round(num * 1_000_000)
    case 'k':   return Math.round(num * 1_000)
    default:    return Math.round(num)
  }
}

export function formatYang(value) {
  const v = Math.round(Number(value) || 0)

  if (v < 1_000) return `${v} yang`

  if (v < 1_000_000) {
    const n = v / 1_000
    return `${parseFloat(n.toFixed(3))}k yang`
  }

  if (v < 1_000_000_000) {
    const intPart = Math.floor(v / 1_000_000)
    const kRemainder = Math.floor((v % 1_000_000) / 1_000)
    if (kRemainder === 0) return `${intPart}kk yang`
    return `${intPart}.${String(kRemainder).padStart(3, '0')}kk yang`
  }

  const intPart = Math.floor(v / 1_000_000_000)
  const kkRemainder = Math.floor((v % 1_000_000_000) / 1_000_000)
  if (kkRemainder === 0) return `${intPart}kkk yang`
  return `${intPart}.${String(kkRemainder).padStart(3, '0')}kkk yang`
}
