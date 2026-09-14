-- Adds an optional free-text comment to ore_finder_ores reports, so whoever
-- marks the ore can leave extra info to help others find it faster.
-- Additive only - safe to run against the existing production D1 database.

ALTER TABLE ore_finder_ores ADD COLUMN comment TEXT;
