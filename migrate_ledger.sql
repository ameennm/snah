-- Safe migration: Add created_by to ledger if not present
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a workaround

-- First check if the column exists by trying to select it
-- If this fails, we need to add the column manually

-- For D1, just try adding - if it fails it already exists  
ALTER TABLE ledger ADD COLUMN created_by INTEGER;
