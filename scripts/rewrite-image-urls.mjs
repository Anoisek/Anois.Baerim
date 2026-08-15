// One-time script to rewrite image_url / image_urls columns from Supabase Storage
// public URLs to the new Cloudflare R2 public URL, after migrate-images-to-r2.mjs
// has copied the underlying files (same bucket-prefixed object path, so this is a
// plain string-prefix replace, no new mapping needed).
//
// Usage (from repo root):
//   node scripts/rewrite-image-urls.mjs           -> dry run, prints what would change
//   node scripts/rewrite-image-urls.mjs --apply    -> actually writes the changes
//
// Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the repo's .env file.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function loadEnv() {
  const envPath = path.resolve(import.meta.dirname, '..', '.env')
  const text = readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const PUBLIC_R2_URL = 'https://pub-ca333e738137481fa823decac7e5d3f8.r2.dev'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const OLD_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function rewrite(url) {
  if (typeof url !== 'string' || !url.startsWith(OLD_PREFIX)) return url
  return PUBLIC_R2_URL + '/' + url.slice(OLD_PREFIX.length)
}

// { table, idColumn, columns: [{ name, isArray }] }
const TARGETS = [
  { table: 'categories', id: 'id', columns: [{ name: 'image_url' }] },
  { table: 'subcategories', id: 'id', columns: [{ name: 'image_url' }] },
  { table: 'items', id: 'id', columns: [{ name: 'image_url' }, { name: 'image_urls', isArray: true }] },
  { table: 'materials', id: 'id', columns: [{ name: 'image_url' }, { name: 'image_urls', isArray: true }] },
  { table: 'exploration_levels', id: 'level', columns: [{ name: 'image_urls', isArray: true }] },
  { table: 'maps', id: 'id', columns: [{ name: 'image_url' }] },
  { table: 'map_marker_notes', id: 'id', columns: [{ name: 'image_url' }] },
  { table: 'settings', id: 'key', columns: [{ name: 'value' }] },
]

async function main() {
  console.log(APPLY ? 'Running in APPLY mode — will write changes.' : 'Running in DRY RUN mode — no writes. Pass --apply to actually update.')

  let totalChanged = 0

  for (const target of TARGETS) {
    const selectCols = [target.id, ...target.columns.map(c => c.name)].join(',')
    const { data: rows, error } = await supabase.from(target.table).select(selectCols)
    if (error) {
      console.error(`  FAIL select ${target.table}:`, error.message)
      continue
    }

    let changedInTable = 0
    for (const row of rows) {
      const patch = {}
      let rowChanged = false

      for (const col of target.columns) {
        const value = row[col.name]
        if (col.isArray) {
          if (!Array.isArray(value)) continue
          const newValue = value.map(rewrite)
          if (newValue.some((v, i) => v !== value[i])) {
            patch[col.name] = newValue
            rowChanged = true
          }
        } else {
          const newValue = rewrite(value)
          if (newValue !== value) {
            patch[col.name] = newValue
            rowChanged = true
          }
        }
      }

      if (rowChanged) {
        changedInTable++
        totalChanged++
        if (APPLY) {
          const { error: updateError } = await supabase.from(target.table).update(patch).eq(target.id, row[target.id])
          if (updateError) console.error(`  FAIL update ${target.table}#${row[target.id]}:`, updateError.message)
        }
      }
    }

    console.log(`${target.table}: ${changedInTable}/${rows.length} row(s) ${APPLY ? 'updated' : 'would change'}`)
  }

  console.log(`\nTotal: ${totalChanged} row(s) ${APPLY ? 'updated' : 'would change'}.`)
}

main()
