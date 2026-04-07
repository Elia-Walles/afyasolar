ALTER TABLE maintenance_requests
ADD COLUMN IF NOT EXISTS started_at DATETIME NULL AFTER quote_accepted_at;

