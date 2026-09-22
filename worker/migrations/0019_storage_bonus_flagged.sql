-- Marks a storage_item_bonuses row as unverified (shown in red on Item storage)
-- so bulk-imported data that wasn't cross-checked against the source PDF can be
-- flagged for manual review.
ALTER TABLE storage_item_bonuses ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
