-- Last zone alert per map ("@Ore Finder bio" -> circle sent to every alert
-- channel), so each map is zone-reported at most once per ore cycle.
CREATE TABLE ore_finder_zone_alerts (
  map TEXT PRIMARY KEY,
  zone_name TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
