-- Adds the /systems/ore-finder table: at most one active legendary-ore
-- report per map (Yongan, Joan, Pyungmoo), enforced by the unique index.
-- Additive only - safe to run against the existing production D1 database.

CREATE TABLE ore_finder_ores (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  discord_message_id TEXT
);
CREATE UNIQUE INDEX idx_ore_finder_ores_map ON ore_finder_ores(map);
