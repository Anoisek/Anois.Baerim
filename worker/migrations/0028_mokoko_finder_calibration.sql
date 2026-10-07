-- Admin-placed calibration points for /mokoko-finder: a spot on the map image
-- (x/y = image percentages, 0-100) plus the in-game X/Y the admin read off at
-- that spot. The page fits a linear image->game mapping per axis from these,
-- overriding the hard-coded MAP_GAME_COORDS. Additive only.
CREATE TABLE mokoko_finder_calibration (
  id TEXT PRIMARY KEY,
  map TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  game_x REAL NOT NULL,
  game_y REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mokoko_finder_calibration_map ON mokoko_finder_calibration(map);
