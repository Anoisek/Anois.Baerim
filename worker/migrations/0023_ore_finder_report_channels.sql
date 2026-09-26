-- Channels set up with /orefinder-reportmap: each one takes ore reports for a
-- single map - people mention the bot with just the coordinates
-- ("@Ore Finder 512 734") and the reader (src/oreFinderReader.js) picks it up.
CREATE TABLE ore_finder_report_channels (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  map TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
