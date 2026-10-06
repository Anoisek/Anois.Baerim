-- Optional per-map video link (admin fills it in), shown to users above the
-- interactive map as "Check the video of this map!". Additive only.
ALTER TABLE maps ADD COLUMN video_url TEXT;
