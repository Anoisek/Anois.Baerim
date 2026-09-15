// Foundations for the /systems/ore-finder Discord integration: whenever a
// legendary ore is reported, post the map image (with a marker at the ore's
// spot) into a Discord channel via a bot. Inert until ORE_FINDER_DISCORD_BOT_TOKEN
// and ORE_FINDER_DISCORD_CHANNEL_ID are actually set - mirrors worker/src/discord.js
// (the dogtracker alert), but deliberately uses its own bot/token/channel/role,
// never the dogtracker ones.

import { PhotonImage } from '@cf-wasm/photon/workerd'

const MARKER_RADIUS = 16
const MARKER_BORDER = 5
const MARKER_FILL = [234, 179, 8, 255] // yellow-500
const MARKER_BORDER_COLOR = [255, 255, 255, 255]
// Each map also goes by its in-game color name - shown alongside the map
// name in alerts, e.g. "Map: Yongan (red)".
const MAP_COLORS = { Yongan: 'red', Joan: 'yellow', Pyungmoo: 'blue' }

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

// Fetches the base map straight from R2 (our own bucket - no reason to
// round-trip through this same worker's public /images/ URL over HTTP) and
// paints a white-bordered yellow dot at the ore's position.
async function buildOreMapImage(env, map, ore) {
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

  const cx = (ore.x / 100) * width
  const cy = (ore.y / 100) * height
  paintFilledCircle(pixels, width, height, cx, cy, MARKER_RADIUS + MARKER_BORDER, MARKER_BORDER_COLOR)
  paintFilledCircle(pixels, width, height, cx, cy, MARKER_RADIUS, MARKER_FILL)

  const marked = new PhotonImage(pixels, width, height)
  const png = marked.get_bytes()
  image.free()
  marked.free()
  return png
}

async function postOreAlert(env, channelId, roleId, description, png, createdAt) {
  const payload = {
    content: roleId ? `<@&${roleId}>` : undefined,
    embeds: [{
      title: '🪨 Legendary ore found!',
      description,
      color: 15521848, // yellow-500-ish
      image: { url: 'attachment://ore-map.png' },
      timestamp: createdAt,
    }],
  }

  const form = new FormData()
  form.append('payload_json', JSON.stringify(payload))
  form.append('files[0]', new Blob([png], { type: 'image/png' }), 'ore-map.png')

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${env.ORE_FINDER_DISCORD_BOT_TOKEN}` },
    body: form,
  })
  if (!res.ok) {
    console.log('ore finder discord send failed', channelId, res.status, await res.text().catch(() => ''))
  }
}

// Sends to every configured destination: the single legacy channel/role from
// wrangler.toml vars (kept working as-is, no migration needed) plus every
// server that has set itself up via /orefinder-here + /orefinder-role.
async function sendDiscordOreAlert(env, ore) {
  if (!env.ORE_FINDER_DISCORD_BOT_TOKEN) return

  try {
    const map = await env.DB.prepare('SELECT image_url, width, height FROM maps WHERE name = ?').bind(ore.map).first()
    if (!map) return

    const png = await buildOreMapImage(env, map, ore)

    const pixelX = Math.round((ore.x / 100) * map.width)
    const pixelY = Math.round((ore.y / 100) * map.height)
    const description = [
      `🗺️ Map: **${ore.map} (${MAP_COLORS[ore.map] || ore.map})**`,
      `📍 Coords: **${pixelX}, ${pixelY}**`,
      ore.comment ? `💬 ${ore.comment}` : null,
    ].filter(Boolean).join('\n')

    const destinations = []
    if (env.ORE_FINDER_DISCORD_CHANNEL_ID) {
      destinations.push({ channelId: env.ORE_FINDER_DISCORD_CHANNEL_ID, roleId: env.ORE_FINDER_DISCORD_ROLE_ID })
    }
    const configured = await env.DB.prepare('SELECT channel_id, role_id, excluded_maps FROM ore_finder_discord_configs').all()
    for (const row of configured.results) {
      let excluded = []
      if (row.excluded_maps) {
        try { excluded = JSON.parse(row.excluded_maps) } catch { excluded = [] }
      }
      if (excluded.includes(ore.map)) continue
      destinations.push({ channelId: row.channel_id, roleId: row.role_id })
    }

    await Promise.all(destinations.map(d => postOreAlert(env, d.channelId, d.roleId, description, png, ore.created_at)))
  } catch (err) {
    console.log('ore finder discord send error', err && err.message)
  }
}

export { sendDiscordOreAlert }
