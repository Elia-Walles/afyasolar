ALTER TABLE `maintenance_requests`
  ADD COLUMN IF NOT EXISTS `advance_payment_amount` DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `advance_payment_status` ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS `advance_paid_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `final_payment_amount` DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `final_payment_status` ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS `final_paid_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `report_approved_at` DATETIME NULL;

ALTER TABLE `maintenance_requests`
  MODIFY COLUMN `status` ENUM(
    'pending','engineer_assigned','engineer_confirmed','under_inspection',
    'quote_submitted','quote_approved','quote_accepted','advance_due','advance_paid',
    'in_progress','report_submitted','final_payment_due','completed','reviewed','cancelled'
  ) NOT NULL DEFAULT 'pending';


