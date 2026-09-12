-- Links a dogtracker_dogs row to the Discord message the alert bot posted
-- for it, so a reaction listener can look the dog up from the message id.
-- Additive only - safe to run against the existing production D1 database.

ALTER TABLE dogtracker_dogs ADD COLUMN discord_message_id TEXT;
