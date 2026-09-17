-- Mokoko Finder: players mark where they found a mokoko, attach a screenshot
-- as proof and the exact coordinates, and it waits in mokoko_finder_reports
-- until an admin approves it - at which point it's copied into
-- mokoko_finder_spots (permanent, shown on the map with the mokoko icon).
-- Rejecting (or after approval) just deletes the report row.
-- Additive only - safe to run against the existing production D1 database.

CREATE TABLE mokoko_finder_reports (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  screenshot_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mokoko_finder_reports_map ON mokoko_finder_reports(map);

CREATE TABLE mokoko_finder_spots (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  screenshot_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mokoko_finder_spots_map ON mokoko_finder_spots(map);
