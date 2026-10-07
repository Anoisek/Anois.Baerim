-- Admin-only "ghost" mokoko on /mokoko-finder: a sighting someone told the
-- admin about (Discord DM etc.) that hasn't been checked yet. Shown only to
-- the admin, as a red mokoko, with an optional note (e.g. who reported it).
-- Nothing is mirrored to the interactive map until the admin approves it -
-- approving turns it into a regular mokoko_finder_spots row (no screenshot)
-- and deletes the ghost. Additive only.
CREATE TABLE mokoko_finder_ghosts (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mokoko_finder_ghosts_map ON mokoko_finder_ghosts(map);
