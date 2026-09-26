-- A report channel isn't read again until this time after it reported an ore
-- (= the end of that report window), see src/oreFinderReader.js.
ALTER TABLE ore_finder_report_channels ADD COLUMN paused_until TEXT;
