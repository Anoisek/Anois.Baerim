-- Sorting-only category tag for materials (Ore, Pearl, Material, Craft, Monkey, Serpent,
-- Baroness, DT, DC, Dragon, Jungle, Razador, Nemere, Seal, Scroll).
-- Independent from the existing is_upgrade_scroll/is_seal/is_item tag and never shown as a badge.
alter table materials add column category_tag text;
