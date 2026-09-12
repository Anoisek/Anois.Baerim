// Standalone reaction listener for /dogtracker: when someone reacts with
// the checkmark the alert bot already put on its own "new dog found"
// message, look that dog up by the message id and delete it from the map.
//
// This has to run as its own persistent process - it's a separate piece
// from the Cloudflare Worker (worker/src/discord.js), which only ever sends
// messages and can't hold a Discord Gateway connection open to receive
// reaction events. Run this wherever you already keep long-running
// processes (a small VPS, etc).
//
// Setup:
//   cd discord-bot
//   npm install
//   DISCORD_BOT_TOKEN=<same token the worker uses> node index.js
//
// WORKER_URL defaults to the production worker; override it if needed.

import { Client, GatewayIntentBits, Partials } from 'discord.js'

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const WORKER_URL = process.env.WORKER_URL || 'https://baerim-images-worker.bartoszlisowiec.workers.dev'
const CHECKMARK = '✅'

if (!DISCORD_BOT_TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN environment variable.')
  process.exit(1)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  // Reactions on messages the bot hasn't cached (e.g. after a restart)
  // arrive as partials - these let discord.js fetch the full data on demand
  // instead of silently dropping the event.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
})

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}, watching for ${CHECKMARK} reactions.`)
})

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    // Ignore the bot's own checkmark it pre-adds to every alert, and
    // anything that isn't the checkmark reaction at all.
    if (user.bot || reaction.emoji.name !== CHECKMARK) return
    if (reaction.partial) await reaction.fetch()

    const messageId = reaction.message.id
    const lookup = await fetch(`${WORKER_URL}/db/dogtracker_dogs?discord_message_id=eq.${messageId}`)
    const { data } = await lookup.json()
    const dog = data && data[0]
    if (!dog) return // not a dogtracker alert message, or already removed

    const del = await fetch(`${WORKER_URL}/db/dogtracker_dogs?id=eq.${dog.id}`, { method: 'DELETE' })
    if (!del.ok) {
      console.error('Failed to delete dog', dog.id, del.status, await del.text().catch(() => ''))
      return
    }
    console.log(`Dog ${dog.id} removed - confirmed gone by ${user.tag} on message ${messageId}.`)
  } catch (err) {
    console.error('Failed to process reaction:', err)
  }
})

client.login(DISCORD_BOT_TOKEN)
