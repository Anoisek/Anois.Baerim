-- Adds the /dogtracker Web Push subscription store.
-- Additive only - safe to run against the existing production D1 database.

CREATE TABLE dogtracker_push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
