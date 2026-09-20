-- Admin-only "Item storage": a private copy of the Chapter I / Chapter II
-- subcategory tabs (Weapons, Armor, ...) holding items whose bonuses have a
-- separate value for every upgrade level +0..+9. Independent of the public
-- items/subcategories tables. Additive only.

CREATE TABLE storage_tabs (
  id TEXT PRIMARY KEY,
  chapter INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE storage_items (
  id TEXT PRIMARY KEY,
  tab_id TEXT NOT NULL REFERENCES storage_tabs(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_storage_items_tab_id ON storage_items(tab_id);

-- Library of bonus names, reusable across items.
CREATE TABLE storage_bonuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- level_values: JSON array of 10 strings, index = upgrade level (+0..+9).
CREATE TABLE storage_item_bonuses (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES storage_items(id) ON DELETE CASCADE,
  bonus_id TEXT NOT NULL REFERENCES storage_bonuses(id),
  level_values TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_storage_item_bonuses_item_id ON storage_item_bonuses(item_id);

-- Copy of the tabs users can currently see (skips ones hidden while in progress).
INSERT INTO storage_tabs (id, chapter, name, sort_order)
SELECT lower(hex(randomblob(16))),
       CASE c.name WHEN 'Chapter I' THEN 1 ELSE 2 END,
       s.name,
       s.sort_order
FROM subcategories s
JOIN categories c ON c.id = s.category_id
WHERE c.name IN ('Chapter I', 'Chapter 2')
  AND NOT (s.maintenance = 1 AND s.maintenance_hidden = 1);
