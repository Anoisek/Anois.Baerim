-- Adds a role table for accounts that may bypass the /dogtracker Poland-only
-- geo check without being a full admin or map editor.
-- Additive only — safe to run against the existing production D1 database.

CREATE TABLE dogtracker_users (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
