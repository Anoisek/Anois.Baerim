-- Chapter tabs on /materials: a chapter is an extra tab row shown above the
-- Materials/PVP tabs. A material can belong to any number of chapters. A chapter
-- with visible = 0 is hidden from non-admins together with every material in it.
-- Additive only - safe to run against the existing production D1 database.

CREATE TABLE material_chapters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE material_chapter_members (
  chapter_id TEXT NOT NULL REFERENCES material_chapters(id),
  material_id TEXT NOT NULL,
  PRIMARY KEY (chapter_id, material_id)
);
CREATE INDEX idx_material_chapter_members_material_id ON material_chapter_members(material_id);

INSERT INTO material_chapters (id, name, visible, sort_order) VALUES
  ('chapter-1', 'Chapter I', 1, 1),
  ('chapter-2', 'Chapter II', 1, 2);
