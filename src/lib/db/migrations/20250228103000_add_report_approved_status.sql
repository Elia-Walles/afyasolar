ALTER TABLE `maintenance_requests`
  MODIFY COLUMN `status` ENUM(
    'pending','engineer_assigned','engineer_confirmed','under_inspection',
    'quote_submitted','quote_approved','quote_accepted','advance_due','advance_paid',
    'in_progress','report_submitted','report_approved','final_payment_due',
    'completed','reviewed','cancelled'
  ) NOT NULL DEFAULT 'pending';


