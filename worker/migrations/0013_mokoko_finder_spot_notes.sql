-- Lets an admin merge several mokoko_finder_reports of the same sighting into
-- one mokoko_finder_spots row with hand-picked exact coordinates: the first
-- report's screenshot becomes the spot's own screenshot_url, and every other
-- merged report's screenshot is kept here as a comment/photo on that spot.
-- Additive only - safe to run against the existing production D1 database.

CREATE TABLE mokoko_finder_spot_notes (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES mokoko_finder_spots(id),
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mokoko_finder_spot_notes_spot_id ON mokoko_finder_spot_notes(spot_id);
