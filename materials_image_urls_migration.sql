-- Multiple images per material, same mechanism as items (image_urls array,
-- image_url kept in sync with the first entry for existing small-icon spots).
alter table materials add column image_urls text[];
