// One-time script (Phase 2.x) to pull tables out of Supabase Postgres via PostgREST and
// print D1-ready SQL INSERT statements. Does NOT touch Postgres (read-only) and does NOT
// write to D1 itself — it only generates SQL, which is then applied via the D1 HTTP API.
// Run: node scripts/migrate-postgres-to-d1.mjs > out.sql
// Optionally restrict to specific tables (e.g. when migrating a later phase's tables
// without re-inserting ones already migrated): node scripts/migrate-postgres-to-d1.mjs global_prices global_price_submissions > out.sql
//
// Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the repo's .env file.

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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

// Order matters: parents before children (FK safety).
const TABLES = [
  { name: 'categories', columns: ['id', 'name', 'image_url', 'created_at', 'sort_order', 'maintenance'], booleans: ['maintenance'] },
  { name: 'subcategories', columns: ['id', 'category_id', 'name', 'image_url', 'created_at', 'sort_order', 'maintenance'], booleans: ['maintenance'] },
  { name: 'items', columns: ['id', 'category_id', 'name', 'image_url', 'created_at', 'subcategory_id', 'image_urls', 'sort_order', 'maintenance'], booleans: ['maintenance'], jsonArrays: ['image_urls'] },
  { name: 'materials', columns: ['id', 'name', 'image_url', 'created_at', 'is_upgrade_scroll', 'is_seal', 'is_item', 'is_craftable', 'craft_yang_cost', 'is_pvp', 'is_pvp_only', 'category_tag', 'image_urls'], booleans: ['is_upgrade_scroll', 'is_seal', 'is_item', 'is_craftable', 'is_pvp', 'is_pvp_only'], jsonArrays: ['image_urls'] },
  { name: 'item_materials', columns: ['item_id', 'material_id', 'quantity', 'step', 'variant'] },
  { name: 'item_items', columns: ['item_id', 'component_item_id', 'quantity', 'step', 'variant'] },
  { name: 'item_step_yang', columns: ['item_id', 'step', 'yang_cost', 'max_pity', 'variant'] },
  { name: 'material_materials', columns: ['material_id', 'component_id', 'quantity', 'variant'] },
  { name: 'material_craft_variant_yield', columns: ['material_id', 'variant', 'yield'] },
  { name: 'exploration_levels', columns: ['level', 'title', 'description', 'x_percent', 'y_percent', 'image_urls'], jsonArrays: ['image_urls'] },
  { name: 'settings', columns: ['key', 'value'] },
  { name: 'global_prices', columns: ['material_id', 'price', 'submission_count', 'updated_at'] },
  { name: 'global_price_submissions', columns: ['id', 'material_id', 'price', 'created_at'] },
]

const PAGE_SIZE = 1000

async function fetchAll(table, columns) {
  const all = []
  let offset = 0
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${columns.join(',')}&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
    )
    if (!res.ok) throw new Error(`fetch ${table} failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return "'" + String(v).replace(/'/g, "''") + "'"
}

async function main() {
  const only = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const tables = only.length > 0 ? TABLES.filter(t => only.includes(t.name)) : TABLES

  const lines = []
  let totalRows = 0

  for (const table of tables) {
    const rows = await fetchAll(table.name, table.columns)
    console.error(`${table.name}: ${rows.length} rows`)
    totalRows += rows.length

    for (const row of rows) {
      const values = table.columns.map(col => {
        let v = row[col]
        if ((table.booleans || []).includes(col)) v = !!v
        if ((table.jsonArrays || []).includes(col)) v = JSON.stringify(v ?? [])
        return sqlVal(v)
      })
      lines.push(`INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${values.join(', ')});`)
    }
  }

  console.error(`\nTotal: ${totalRows} rows across ${tables.length} tables.`)
  console.log(lines.join('\n'))
}

main()
