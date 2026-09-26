-- Admin-only circles marked on the Ore Finder maps (name + position + size).
-- Never public: the table is admin-read-only in src/db.js. x/y are % of the
-- map image, r is the radius as % of the map width.
CREATE TABLE ore_finder_zones (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  r REAL NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL
);
