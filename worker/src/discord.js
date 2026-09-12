// Foundations for the /dogtracker Discord integration: whenever a dog is
// reported, post the map image (with a marker at the dog's spot) plus the
// nearest teleport into a Discord channel via a bot. Inert until
// DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID are actually set - the bot itself
// (token, channel, invite) is set up separately; this is just the sending
// side, ready to switch on the moment those two values exist.

import { PhotonImage } from '@cf-wasm/photon/workerd'
import { buildRouteGraph, nearestTeleport } from './routing.js'

const MAP_NAME = 'Dragon Flame Cape'
const METINS = ['Metin of Gloom', 'Metin of Ember', 'Metin of Wrath', 'Metin of Calamity']
const TIERS = ['I', 'II', 'III']
const MARKER_RADIUS = 16
const MARKER_BORDER = 5
const MARKER_FILL = [220, 38, 38, 255] // red-600
const MARKER_BORDER_COLOR = [255, 255, 255, 255]

function tabKey(metin, tier) {
  return `${metin}__${tier}`
}

async function loadJsonSetting(env, key) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first()
  if (!row || !row.value) return null
  try {
    return JSON.parse(row.value)
  } catch {
    return null
  }
}

function paintFilledCircle(pixels, width, height, cx, cy, radius, rgba) {
  const r2 = radius * radius
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(width - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(height - 1, Math.ceil(cy + radius))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx + 0.5
      const dy = y - cy + 0.5
      if (dx * dx + dy * dy > r2) continue
      const idx = (y * width + x) * 4
      pixels[idx] = rgba[0]
      pixels[idx + 1] = rgba[1]
      pixels[idx + 2] = rgba[2]
      pixels[idx + 3] = rgba[3]
    }
  }
}

// Fetches the base map straight from R2 (it's our own bucket - no reason to
// round-trip through this same worker's public /images/ URL over HTTP) and
// paints a white-bordered red dot at the dog's position.
async function buildDogMapImage(env, map, dog) {
  const prefix = env.PUBLIC_R2_URL + '/'
  if (!map.image_url.startsWith(prefix)) throw new Error('map image_url is not from this worker\'s R2 bucket')
  const key = map.image_url.slice(prefix.length)
  const object = await env.IMAGES_BUCKET.get(key)
  if (!object) throw new Error('map image not found in R2: ' + key)
  const bytes = new Uint8Array(await object.arrayBuffer())

  const image = PhotonImage.new_from_byteslice(bytes)
  const width = image.get_width()
  const height = image.get_height()
  const pixels = image.get_raw_pixels()

  const cx = (dog.x / 100) * width
  const cy = (dog.y / 100) * height
  paintFilledCircle(pixels, width, height, cx, cy, MARKER_RADIUS + MARKER_BORDER, MARKER_BORDER_COLOR)
  paintFilledCircle(pixels, width, height, cx, cy, MARKER_RADIUS, MARKER_FILL)

  const marked = new PhotonImage(pixels, width, height)
  const png = marked.get_bytes()
  image.free()
  marked.free()
  return png
}

async function computeNearestTeleportName(env, dog) {
  const [circles, paths, walls] = await Promise.all([
    loadJsonSetting(env, 'dogtracker_circles'),
    loadJsonSetting(env, 'dogtracker_paths'),
    loadJsonSetting(env, 'dogtracker_walls'),
  ])
  const teleportCandidates = []
  for (const metin of METINS) {
    for (const tier of TIERS) {
      const c = circles && circles[tabKey(metin, tier)]
      if (c) teleportCandidates.push({ name: `${metin} ${tier}`, x: c.x, y: c.y })
    }
  }
  const graph = buildRouteGraph(paths || [], walls || [])
  const best = nearestTeleport(dog, graph, teleportCandidates, walls || [])
  return best ? best.name : null
}

async function sendDiscordDogAlert(env, dog) {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) return

  try {
    const map = await env.DB.prepare('SELECT image_url FROM maps WHERE name = ?').bind(MAP_NAME).first()
    if (!map) return

    const [png, teleportName] = await Promise.all([
      buildDogMapImage(env, map, dog),
      computeNearestTeleportName(env, dog),
    ])

    const description = [
      `Channel **CH${dog.channel}**`,
      teleportName ? `📍 Nearest teleport: **${teleportName}**` : null,
    ].filter(Boolean).join('\n')

    const payload = {
      embeds: [{
        title: '🐕 New dog found!',
        description,
        color: 15548997,
        image: { url: 'attachment://dog-map.png' },
        timestamp: dog.created_at,
      }],
    }

    const form = new FormData()
    form.append('payload_json', JSON.stringify(payload))
    form.append('files[0]', new Blob([png], { type: 'image/png' }), 'dog-map.png')

    const res = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
      body: form,
    })
    if (!res.ok) {
      console.log('dogtracker discord send failed', res.status, await res.text().catch(() => ''))
      return
    }

    // Remember which message this dog's alert is, so a reaction listener can
    // look the dog back up from the message id, and pre-add the checkmark so
    // confirming "not here anymore" is just one click on the existing reaction.
    const message = await res.json()
    await env.DB.prepare('UPDATE dogtracker_dogs SET discord_message_id = ? WHERE id = ?').bind(message.id, dog.id).run()
    await fetch(
      `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages/${message.id}/reactions/%E2%9C%85/@me`,
      { method: 'PUT', headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }
    )
  } catch (err) {
    console.log('dogtracker discord send error', err && err.message)
  }
}

export { sendDiscordDogAlert }
