import { createWorker, PSM } from 'tesseract.js'

// Runs OCR on a single screenshot and returns the raw recognized text.
// SINGLE_COLUMN page segmentation (rather than Tesseract's default automatic
// layout detection) measurably improves accuracy on this game panel — it's a
// single vertical list of icon+name+number rows, not prose, and the default
// mode frequently drops or scrambles the number that trails each row.
export async function ocrImage(file, onProgress) {
  const worker = await createWorker('eng', 1, {
    logger: onProgress ? m => { if (m.status === 'recognizing text') onProgress(m.progress) } : undefined,
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
    const { data } = await worker.recognize(file)
    return data.text
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

// Parses the raw OCR text of a "Farm Session" game panel screenshot. The panel
// always has a "Duration HH:MM:SS ... Stones N" header (N is the metin kill
// counter, not a material — a distinct "Stones +0 - +4" material row can also
// exist further down) followed by "Material Name    xQTY" rows.
export function parseFarmSessionText(text) {
  const durationMatch = text.match(/Duration\D{0,10}(\d{1,2}:\d{2}:\d{2})/i)
  const killsMatch = text.match(/Duration[\s\S]{0,60}?Stones\s+(\d+)(?!\s*[+x×])/i)

  // Row-per-line: "<icon-glyph-noise> Name ... [x]QTY". The "x" separator is
  // frequently dropped by OCR, so a bare trailing number is accepted too —
  // requiring it to end the line (not just appear anywhere) keeps this from
  // matching stray numbers inside a name.
  const rows = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || /^duration\b/i.test(line) || /^farm session\b/i.test(line)) continue
    const rowMatch = line.match(/^(.*?)\s*[x×]?\s*([\d,]{2,7})$/)
    if (!rowMatch) continue
    const name = rowMatch[1].trim().replace(/^[^A-Za-z]+/, '').replace(/\s+/g, ' ')
    const quantity = Number(rowMatch[2].replace(/,/g, ''))
    if (name.length < 3 || !Number.isFinite(quantity) || quantity <= 0) continue
    rows.push({ name, quantity })
  }

  return {
    duration: durationMatch ? durationMatch[1] : null,
    kills: killsMatch ? Number(killsMatch[1]) : null,
    rows,
  }
}

// Merges parsed data from several screenshots of the same (scrolled) session:
// duration/kills only ever grow within a session, so the max across shots is
// the latest true reading. A material row can appear in more than one shot if
// the scroll position overlapped — again, max is the correct value.
export function mergeFarmSessions(parsedList) {
  let maxSeconds = 0
  let maxKills = 0
  const rows = []
  for (const parsed of parsedList) {
    if (parsed.duration) maxSeconds = Math.max(maxSeconds, durationToSeconds(parsed.duration))
    if (parsed.kills != null) maxKills = Math.max(maxKills, parsed.kills)
    rows.push(...parsed.rows)
  }
  return {
    duration: maxSeconds > 0 ? secondsToDuration(maxSeconds) : null,
    kills: maxKills > 0 ? maxKills : null,
    rows,
  }
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

function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

// Matches OCR'd row names against a fixed, small set of candidates (a specific
// metin's own drop list) rather than the whole materials table — restricting
// the search space this way is what makes fuzzy-matching noisy OCR text usable.
export function matchRowsToMaterials(rows, materialOptions) {
  const matched = {} // materialId -> quantity
  const unmatched = []
  for (const row of rows) {
    let best = null
    let bestScore = 0
    for (const opt of materialOptions) {
      const score = similarity(normalize(row.name), normalize(opt.name))
      if (score > bestScore) { bestScore = score; best = opt }
    }
    if (best && bestScore >= 0.75) {
      matched[best.id] = Math.max(matched[best.id] ?? 0, row.quantity)
    } else {
      unmatched.push(row)
    }
  }
  return { matched, unmatched }
}
