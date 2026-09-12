# dogtracker reaction bot

Separate, always-running companion to the Cloudflare Worker's Discord
integration (`worker/src/discord.js`). The Worker sends the "new dog found"
alerts and pre-adds a ✅ reaction to each one; this bot watches for someone
else clicking that same ✅ and deletes the corresponding dog from the map.

It has to run as its own persistent process somewhere (a small VPS, a
Raspberry Pi, any always-on machine) - a Cloudflare Worker can't hold a
Discord Gateway connection open to receive reaction events, so this can't be
folded into the Worker itself.

## Setup

```bash
cd discord-bot
npm install
DISCORD_BOT_TOKEN=<same token used for DISCORD_BOT_TOKEN on the worker> node index.js
```

Optional: `WORKER_URL` env var if the worker ever moves off its default
`https://baerim-images-worker.bartoszlisowiec.workers.dev` URL.

No Discord Developer Portal changes needed beyond what's already set up for
sending alerts - reading reactions doesn't require any privileged intent.

To keep it running permanently, use whatever process manager you're
comfortable with (pm2, a systemd service, a Docker container that
auto-restarts, etc.) - `node index.js` on its own exits if it crashes.
