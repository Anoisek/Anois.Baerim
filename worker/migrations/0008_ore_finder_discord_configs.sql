-- Per-Discord-server config for the Ore Finder alert bot, set via the
-- /orefinder-here and /orefinder-role slash commands. Additive only - safe
-- to run against the existing production D1 database.

CREATE TABLE ore_finder_discord_configs (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  role_id TEXT,
  updated_at TEXT NOT NULL
);
