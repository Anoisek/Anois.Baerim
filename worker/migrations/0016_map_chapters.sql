-- Interactive map sidebar is grouped into collapsible Chapter I / Chapter II
-- lists. Every existing map lands in Chapter I (default 1). Additive only.

ALTER TABLE maps ADD COLUMN chapter INTEGER NOT NULL DEFAULT 1;
