-- Adds the /kompendium community-guide tables (guide_items, guide_suggestions).
-- Additive only — safe to run against the existing production D1 database.

CREATE TABLE guide_items (
  category_id TEXT NOT NULL,
  item_index INTEGER NOT NULL,
  lang TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (category_id, item_index, lang)
);

CREATE TABLE guide_suggestions (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  item_index INTEGER NOT NULL,
  lang TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_guide_suggestions_category_lang ON guide_suggestions(category_id, lang);
