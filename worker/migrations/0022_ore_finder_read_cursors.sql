-- Ore Finder channel reader: last message id already read per channel, so each
-- poll only fetches newer messages (see src/oreFinderReader.js).
CREATE TABLE ore_finder_read_cursors (
  channel_id TEXT PRIMARY KEY,
  last_message_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
