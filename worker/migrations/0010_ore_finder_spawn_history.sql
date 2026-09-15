-- Permanent log of every successful legendary-ore report (map, x, y) for the
-- "show past spawn locations" toggle on the Ore Finder map - unlike
-- ore_finder_ores, rows here are never deleted once a report expires.
-- Additive only - safe to run against the existing production D1 database.

CREATE TABLE ore_finder_spawn_history (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ore_finder_spawn_history_map ON ore_finder_spawn_history(map);
