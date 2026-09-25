-- Each approved /mokoko-finder spot is mirrored as a marker on the interactive
-- map (maps row with the same name). marker_id links the two so deleting the
-- spot also removes its marker. NULL = no mirrored marker (e.g. the map isn't
-- on the interactive map yet).
ALTER TABLE mokoko_finder_spots ADD COLUMN marker_id TEXT;
