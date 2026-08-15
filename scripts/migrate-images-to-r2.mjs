// One-time script to copy every object from Supabase Storage buckets `images`
// and `map-notes` into the Cloudflare R2 bucket `baerim-images`, preserving the
// original object path under a bucket-name prefix (images/<name>, map-notes/<name>).
// This lets the follow-up URL-rewrite script (rewrite-image-urls.mjs) derive the
// new URL from the old one with a plain string replace.
//
// Usage (from repo root): node scripts/migrate-images-to-r2.mjs
//
// Reads VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CF_ACCOUNT_ID, CF_API_TOKEN
// from the repo's .env file. Does NOT delete anything from Supabase Storage.

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
const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID
const CF_API_TOKEN = env.CF_API_TOKEN
const R2_BUCKET = 'baerim-images'

if (!SUPABASE_URL || !SERVICE_KEY || !CF_ACCOUNT_ID || !CF_API_TOKEN) {
  console.error('Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CF_ACCOUNT_ID or CF_API_TOKEN in .env')
  process.exit(1)
}

const BUCKETS = ['images', 'map-notes']
const PAGE_SIZE = 500

async function listAll(bucket) {
  const all = []
  let offset = 0
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: PAGE_SIZE, offset }),
    })
    if (!res.ok) throw new Error(`list ${bucket} failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    all.push(...page.filter(o => o.id))
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

async function copyObject(bucket, name) {
  const downloadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  })
  if (!downloadRes.ok) throw new Error(`download failed: ${downloadRes.status}`)
  const bytes = Buffer.from(await downloadRes.arrayBuffer())
  const contentType = downloadRes.headers.get('content-type') || 'application/octet-stream'

  const key = `${bucket}/${name}`
  const uploadRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${key}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': contentType },
      body: bytes,
    }
  )
  if (!uploadRes.ok) throw new Error(`upload failed: ${uploadRes.status} ${await uploadRes.text()}`)
}

async function main() {
  let okCount = 0
  let failCount = 0

  for (const bucket of BUCKETS) {
    const objects = await listAll(bucket)
    console.log(`\n${bucket}: ${objects.length} objects`)

    for (let i = 0; i < objects.length; i++) {
      const name = objects[i].name
      try {
        await copyObject(bucket, name)
        okCount++
        if ((i + 1) % 25 === 0 || i === objects.length - 1) {
          console.log(`  ${bucket}: ${i + 1}/${objects.length}`)
        }
      } catch (err) {
        failCount++
        console.error(`  FAIL ${bucket}/${name}:`, err.message ?? err)
      }
    }
  }

  console.log(`\nDone. Copied: ${okCount}, failed: ${failCount}.`)
  if (failCount > 0) process.exitCode = 1
}

main()
