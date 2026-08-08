// One-time script to upload the 14 Mococko map images and seed the `maps` table.
//
// Usage (from repo root): node scripts/seed-maps.mjs
//
// Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the repo's .env file
// (service role bypasses RLS, so no admin login is needed). Images are read from
// scripts/maps-source/ (gitignored). Run interactive_map_migration.sql in the
// Supabase SQL Editor before running this script.

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
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const MAPS_DIR = process.env.MAPS_DIR || path.resolve(import.meta.dirname, 'maps-source')

const MAPS = [
  { file: 'metin2_map_a1_FULL.png', name: 'Joan', region: 'Shinsoo', mark: 'M1', width: 1024, height: 1280 },
  { file: 'metin2_map_a3_FULL.png', name: 'Jayang', region: 'Shinsoo', mark: 'M2', width: 1024, height: 1024 },
  { file: 'metin2_map_b1_FULL.png', name: 'Pyungmoo', region: 'Chunjo', mark: 'M1', width: 1024, height: 1280 },
  { file: 'metin2_map_b3_FULL.png', name: 'Bokjung', region: 'Chunjo', mark: 'M2', width: 1024, height: 1024 },
  { file: 'metin2_map_c1_FULL.png', name: 'Yongan', region: 'Jinno', mark: 'M1', width: 1024, height: 1280 },
  { file: 'metin2_map_c3_FULL.png', name: 'Bakra', region: 'Jinno', mark: 'M2', width: 1024, height: 1024 },
  { file: 'map_a2_FULL.png', name: 'Seungryuong Valley', region: 'Neutral', mark: 'SV', width: 1536, height: 1536 },
  { file: 'metin2_map_n_desert_01_FULL.png', name: 'Yongbi Desert', region: 'Neutral', mark: 'YD', width: 1536, height: 1536 },
  { file: 'metin2_map_milgyo_FULL.png', name: 'Hwang Temple', region: 'Neutral', mark: 'HT', width: 1024, height: 1024 },
  { file: 'map_n_snowm_01_FULL.png', name: 'Mount Sohan', region: 'Neutral', mark: 'MS', width: 1536, height: 1536 },
  { file: 'metin2_map_n_flame_01_FULL.png', name: 'Land of Fire', region: 'Neutral', mark: 'LF', width: 1536, height: 1536 },
  { file: 'metin2_map_trent2_FULL.png', name: 'Red Wood', region: 'Neutral', mark: 'RW', width: 768, height: 768 },
  { file: 'metin2_map_grotto.png', name: 'Grotto of Exile', region: 'Neutral', mark: 'GE', width: 1254, height: 1254 },
  { file: 'metin2_map_dragoncape.png', name: 'Dragon Flame Cape', region: 'Neutral', mark: 'DF', width: 1254, height: 1254 },
]

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  let sortOrder = 0
  let okCount = 0
  for (let i = 0; i < MAPS.length; i++) {
    const m = MAPS[i]
    try {
      const bytes = readFileSync(path.join(MAPS_DIR, m.file))
      const storagePath = `${Date.now()}-${i}.png`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(storagePath, bytes, { contentType: 'image/png' })
      if (uploadError) throw uploadError

      const { data: pub } = supabase.storage.from('images').getPublicUrl(storagePath)

      sortOrder += 10
      const { error: insertError } = await supabase.from('maps').insert({
        name: m.name,
        region: m.region,
        mark: m.mark,
        image_url: pub.publicUrl,
        width: m.width,
        height: m.height,
        sort_order: sortOrder,
      })
      if (insertError) throw insertError

      console.log(`  ok  ${m.name} (${m.file})`)
      okCount++
    } catch (err) {
      console.error(`  FAIL  ${m.name} (${m.file}):`, err.message ?? err)
    }
  }

  console.log(`Done: ${okCount}/${MAPS.length} maps seeded.`)
}

main()
