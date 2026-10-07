-- Locked maps: listed for everyone, but non-admins only get a greyed-out
-- image with "This map is currently not available" - no markers. The worker
-- (hiddenWhere) also withholds their markers/notes and the matching
-- /mokoko-finder spots from non-admin GETs. Additive only.
ALTER TABLE maps ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;

-- Enchanted Forest on the interactive map (same image as /mokoko-finder),
-- locked until it's ready; approved finder spots mirror onto it by name.
INSERT INTO maps (id, name, region, mark, image_url, width, height, sort_order, created_at, max_mokoko, admin_only, chapter, locked)
VALUES ('aeb4201e-6f8b-48bb-adc3-d9c684d53e33', 'Enchanted Forest', 'Neutral', 'EF', 'https://baerimtools.com/mokoko-finder/enchanted-forest.png', 1254, 1254, 170, '2026-10-07T17:10:22.000Z', NULL, 0, 2, 1);
