-- Adds a fourth buff dimension (Guild Drop Blessing) to metin_drop_stats,
-- alongside vote_buff/casual_buff/glove_buff. SQLite can't ALTER a PRIMARY KEY
-- in place, so the table is rebuilt: existing rows are preserved with
-- guild_buff = 0.
-- Already applied directly to production D1 (baerim-db) on 2026-08-17.
-- Note: at the time this ran, metin_drop_stats already had 0 rows (the one
-- metin with submitted stats had been reset via the admin "Reset all" button
-- between sessions), so no data existed to carry over — but the same
-- SELECT-copy step is included below for the general case.

CREATE TABLE metin_drop_stats_new (
  metin_id TEXT NOT NULL REFERENCES metins(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  vote_buff INTEGER NOT NULL DEFAULT 0,
  casual_buff INTEGER NOT NULL DEFAULT 0,
  glove_buff INTEGER NOT NULL DEFAULT 0,
  guild_buff INTEGER NOT NULL DEFAULT 0,
  total_quantity REAL NOT NULL DEFAULT 0,
  total_kills INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metin_id, material_id, vote_buff, casual_buff, glove_buff, guild_buff)
);

INSERT INTO metin_drop_stats_new (metin_id, material_id, vote_buff, casual_buff, glove_buff, guild_buff, total_quantity, total_kills)
  SELECT metin_id, material_id, vote_buff, casual_buff, glove_buff, 0, total_quantity, total_kills FROM metin_drop_stats;

DROP TABLE metin_drop_stats;
ALTER TABLE metin_drop_stats_new RENAME TO metin_drop_stats;
