-- Adds the /dogtracker public dog-sighting reports table.
-- Additive only — safe to run against the existing production D1 database.

CREATE TABLE dogtracker_dogs (
  id TEXT PRIMARY KEY,
  metin TEXT NOT NULL,
  tier TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  channel INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_dogtracker_dogs_metin_tier ON dogtracker_dogs(metin, tier);
