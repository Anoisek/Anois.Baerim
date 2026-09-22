-- Which classes (Warrior/Ninja/Sura/Shaman) can wear a storage_items row, so the
-- Item storage panel can offer class sub-tabs within each category tab.
-- JSON array of strings, e.g. '["Warrior","Ninja","Sura"]'. Empty/NULL = unknown/universal.
ALTER TABLE storage_items ADD COLUMN classes TEXT NOT NULL DEFAULT '[]';
