ALTER TABLE maintenance_requests
ADD COLUMN IF NOT EXISTS payment_completed_at DATETIME NULL AFTER completed_at;

