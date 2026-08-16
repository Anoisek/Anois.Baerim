import { createWorker, PSM } from 'tesseract.js'

// Upscaling small game-UI text measurably improves OCR accuracy over feeding
// Tesseract the screenshot at its native size. Two passes at different target
// widths are merged (see ocrImage) because neither resolution alone reliably
// catches every row — one tends to read the bottom rows' numbers better, the
// other reads the row names better nearer the panel's rounded edges.
async function upscale(file, targetWidth) {
  const bitmap = await createImageBitmap(file)
  const scale = targetWidth / bitmap.width
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

// Runs OCR on a single screenshot twice (at two upscaled resolutions) and
// returns both raw recognized texts — parseFarmSessionText + mergeFarmSessions
// combine whatever each pass caught, the same way multiple screenshots merge.
export async function ocrImage(file, onProgress) {
  const worker = await createWorker('eng', 1, {
    logger: onProgress ? m => { if (m.status === 'recognizing text') onProgress(m.progress) } : undefined,
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
    const texts = []
    for (const width of [1200, 1600]) {
      const upscaled = await upscale(file, width)
      const { data } = await worker.recognize(upscaled)
      texts.push(data.text)
    }
    return texts
  } finally {
    await worker.terminate()
  }
}

function durationToSeconds(hms) {
  const [h, m, s] = hms.split(':').map(Number)
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
}

function secondsToDuration(total) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = Math.floor(total % 60)
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

// A number token mangled by OCR right next to the "x"/"¥" separator this game
// panel uses — only applied to tokens that are already almost all digits, so
// this never touches real words.
function cleanDigits(token) {
  return token.replace(/[oOD]/g, '0').replace(/[lI\]]/g, '1').replace(/[Ss]/g, '5').replace(/[B]/g, '8').replace(/[Zz]/g, '2')
}

// Looks for a quantity anywhere in the line (not strictly at the end) —
// Tesseract frequently renders the "x"/"¥" separator as noise, so the number
// itself, wherever it is, is the more reliable signal.
function extractQuantity(line) {
  const candidates = [...line.matchAll(/(?:^|[^\d])([0-9oOlISsBZz]{1,7})(?:[^\d]|$)/g)]
  for (let i = candidates.length - 1; i >= 0; i--) {
    const raw = candidates[i][1]
    // A lone letter-substitute (no genuine digit at all) is too risky to trust —
    // single-digit quantities (e.g. "x9") only count when the digit itself is real.
    if (raw.length === 1 && !/[0-9]/.test(raw)) continue
    const digitLike = raw.replace(/[oOlISsBZz]/g, '')
    if (digitLike.length / raw.length < 0.4) continue // mostly letters, not a real number
    const cleaned = Number(cleanDigits(raw).replace(/,/g, ''))
    if (Number.isFinite(cleaned) && cleaned > 0) return cleaned
  }
  return null
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

// Best-effort substring-aware similarity (0..1) between two normalized strings.
function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 0.92
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

// Parses one screenshot's raw OCR text (name-anchored — see module intro).
// Each candidate material is checked against every line for the best match;
// a hit is recorded even when no usable quantity could be read on that line,
// so a recognized-but-unreadable-number row still surfaces to the user instead
// of silently vanishing (matchedUnknownQty).
export function parseFarmSessionText(text, materialOptions) {
  const durationMatch = text.match(/Duration\D{0,10}(\d{1,2}:\d{2}:\d{2})/i)
  const killsMatch = text.match(/Duration[\s\S]{0,60}?Stones\s+(\d+)(?!\s*[+x×¥])/i)

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^duration\b/i.test(l) && !/^farm session\b/i.test(l) && !/^lv\s*\d/i.test(l))

  const matched = {} // materialId -> quantity
  const matchedUnknownQty = new Set() // materialId — name recognized, no usable quantity

  for (const opt of materialOptions) {
    const target = normalize(opt.name)
    let best = null
    let bestScore = 0
    for (const line of lines) {
      const stripped = line.replace(/^[^A-Za-z]{0,3}/, '')
      const score = similarity(target, normalize(stripped))
      if (score > bestScore) { bestScore = score; best = line }
    }
    if (bestScore < 0.72 || !best) continue
    const qty = extractQuantity(best)
    if (qty != null) matched[opt.id] = Math.max(matched[opt.id] ?? 0, qty)
    else matchedUnknownQty.add(opt.id)
  }

  return {
    duration: durationMatch ? durationMatch[1] : null,
    kills: killsMatch ? Number(killsMatch[1]) : null,
    matched,
    matchedUnknownQty,
  }
}

// Merges parsed data from several OCR passes/screenshots of the same (scrolled)
// session: duration/kills/quantities only ever grow within a session, so the
// max across passes is the latest true reading. A material resolved with a
// real quantity in ANY pass "wins" over an unknown-quantity finding for it.
export function mergeFarmSessions(parsedList) {
  let maxSeconds = 0
  let maxKills = 0
  const matched = {}
  const matchedUnknownQty = new Set()
  for (const parsed of parsedList) {
    if (parsed.duration) maxSeconds = Math.max(maxSeconds, durationToSeconds(parsed.duration))
    if (parsed.kills != null) maxKills = Math.max(maxKills, parsed.kills)
    for (const [id, qty] of Object.entries(parsed.matched)) matched[id] = Math.max(matched[id] ?? 0, qty)
    for (const id of parsed.matchedUnknownQty) matchedUnknownQty.add(id)
  }
  for (const id of Object.keys(matched)) matchedUnknownQty.delete(id)

  return {
    duration: maxSeconds > 0 ? secondsToDuration(maxSeconds) : null,
    kills: maxKills > 0 ? maxKills : null,
    matched,
    matchedUnknownQty: [...matchedUnknownQty],
  }
}
