-- Per-server map opt-out for Ore Finder alerts, set via /orefinder-removemap
-- and /orefinder-addmap. NULL/empty means "no exclusions" - every map is
-- sent by default, matching the existing behavior before this column existed.
-- Additive only - safe to run against the existing production D1 database.

ALTER TABLE ore_finder_discord_configs ADD COLUMN excluded_maps TEXT;
