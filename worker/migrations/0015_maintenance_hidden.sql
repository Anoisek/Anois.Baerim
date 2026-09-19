-- "In progress" tiles can additionally be hidden from non-admins entirely
-- (categories, subcategories, items). Other tiles (home/systems) keep this flag
-- in the settings table as *_maintenance_hidden. Only takes effect while the
-- tile's maintenance flag is on. Additive only.

ALTER TABLE categories ADD COLUMN maintenance_hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subcategories ADD COLUMN maintenance_hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN maintenance_hidden INTEGER NOT NULL DEFAULT 0;
