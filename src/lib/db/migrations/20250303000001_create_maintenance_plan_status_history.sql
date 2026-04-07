-- Create maintenance_plan_status_history table for audit trail
CREATE TABLE IF NOT EXISTS `maintenance_plan_status_history` (
  `id` VARCHAR(36) PRIMARY KEY,
  `request_id` VARCHAR(36),
  `proposal_id` VARCHAR(36),
  `payment_id` VARCHAR(36),
  `entity_type` ENUM('request', 'proposal', 'payment') NOT NULL,
  `previous_status` VARCHAR(50),
  `new_status` VARCHAR(50) NOT NULL,
  `changed_by` VARCHAR(36) NOT NULL,
  `changed_by_role` ENUM('admin', 'facility', 'technician') NOT NULL,
  `changed_by_name` VARCHAR(255),
  `reason` TEXT,
  `metadata` TEXT,
  `ip_address` VARCHAR(100),
  `user_agent` VARCHAR(255),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `maintenance_plan_history_request_idx` (`request_id`),
  INDEX `maintenance_plan_history_proposal_idx` (`proposal_id`),
  INDEX `maintenance_plan_history_payment_idx` (`payment_id`),
  INDEX `maintenance_plan_history_entity_type_idx` (`entity_type`),
  INDEX `maintenance_plan_history_changed_by_idx` (`changed_by`),
  INDEX `maintenance_plan_history_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
