-- D1 schema for Baerim Calculator (Phase 2 of Supabase -> Cloudflare migration).
-- Conventions: UUID -> TEXT (app-generated via crypto.randomUUID()), text[] -> TEXT (JSON array),
-- timestamptz -> TEXT ISO-8601, boolean -> INTEGER 0/1. Cascades enforced in Worker code, not
-- relied on purely via PRAGMA foreign_keys.

-- Tier 1: catalog
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  maintenance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  maintenance INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_subcategories_category_id ON subcategories(category_id);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL,
  subcategory_id TEXT REFERENCES subcategories(id),
  image_urls TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  maintenance INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_items_category_id ON items(category_id);
CREATE INDEX idx_items_subcategory_id ON items(subcategory_id);

CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL,
  is_upgrade_scroll INTEGER NOT NULL DEFAULT 0,
  is_seal INTEGER NOT NULL DEFAULT 0,
  is_item INTEGER NOT NULL DEFAULT 0,
  is_craftable INTEGER NOT NULL DEFAULT 0,
  craft_yang_cost INTEGER,
  is_pvp INTEGER NOT NULL DEFAULT 0,
  is_pvp_only INTEGER NOT NULL DEFAULT 0,
  category_tag TEXT,
  image_urls TEXT
);

CREATE TABLE item_materials (
  item_id TEXT NOT NULL REFERENCES items(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity REAL NOT NULL DEFAULT 1,
  step INTEGER NOT NULL DEFAULT 0,
  variant INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (item_id, material_id, step, variant)
);
CREATE INDEX idx_item_materials_material_id ON item_materials(material_id);

CREATE TABLE item_items (
  item_id TEXT NOT NULL REFERENCES items(id),
  component_item_id TEXT NOT NULL REFERENCES items(id),
  quantity REAL NOT NULL DEFAULT 1,
  step INTEGER NOT NULL DEFAULT 0,
  variant INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (item_id, component_item_id, step, variant)
);
CREATE INDEX idx_item_items_component_item_id ON item_items(component_item_id);

CREATE TABLE item_step_yang (
  item_id TEXT NOT NULL REFERENCES items(id),
  step INTEGER NOT NULL,
  yang_cost INTEGER NOT NULL DEFAULT 0,
  max_pity INTEGER,
  variant INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (item_id, step, variant)
);

CREATE TABLE material_materials (
  material_id TEXT NOT NULL REFERENCES materials(id),
  component_id TEXT NOT NULL REFERENCES materials(id),
  quantity REAL NOT NULL DEFAULT 1,
  variant INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (material_id, component_id, variant)
);
CREATE INDEX idx_material_materials_component_id ON material_materials(component_id);

CREATE TABLE material_craft_variant_yield (
  material_id TEXT NOT NULL REFERENCES materials(id),
  variant INTEGER NOT NULL,
  yield INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (material_id, variant)
);

CREATE TABLE exploration_levels (
  level INTEGER PRIMARY KEY,
  title TEXT,
  description TEXT,
  x_percent REAL NOT NULL DEFAULT 50,
  y_percent REAL NOT NULL DEFAULT 50,
  image_urls TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Tier 2: community pricing (not migrated in this stage, schema created now for completeness)
CREATE TABLE global_prices (
  material_id TEXT PRIMARY KEY REFERENCES materials(id),
  price REAL NOT NULL,
  submission_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE global_price_submissions (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  price REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_gps_material_created ON global_price_submissions(material_id, created_at DESC);

-- Tier 3: interactive map system (not migrated in this stage, schema created now for completeness)
CREATE TABLE admins (
  user_id TEXT PRIMARY KEY
);

CREATE TABLE map_editors (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  mark TEXT NOT NULL,
  image_url TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  max_mokoko INTEGER,
  admin_only INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE map_markers (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES maps(id),
  x REAL NOT NULL,
  y REAL NOT NULL,
  icon TEXT NOT NULL DEFAULT '📍',
  title TEXT,
  created_at TEXT NOT NULL,
  copied_from TEXT REFERENCES map_markers(id),
  visible_at TEXT
);
CREATE INDEX idx_map_markers_map_id ON map_markers(map_id);

CREATE TABLE map_marker_notes (
  id TEXT PRIMARY KEY,
  marker_id TEXT NOT NULL REFERENCES map_markers(id),
  comment TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_map_marker_notes_marker_id ON map_marker_notes(marker_id);

CREATE TABLE map_helpers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE metins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  image_urls TEXT,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE metin_drops (
  metin_id TEXT NOT NULL REFERENCES metins(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity REAL NOT NULL DEFAULT 1,
  alt_group TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_guaranteed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metin_id, material_id)
);

CREATE TABLE metin_drop_stats (
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

CREATE TABLE bonuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bonus_items (
  id TEXT PRIMARY KEY,
  bonus_id TEXT NOT NULL REFERENCES bonuses(id),
  name TEXT NOT NULL,
  image_url TEXT,
  value REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
