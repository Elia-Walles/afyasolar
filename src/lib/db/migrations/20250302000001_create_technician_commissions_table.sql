-- Create technician_commissions table
CREATE TABLE IF NOT EXISTS `technician_commissions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `technician_id` VARCHAR(36) NOT NULL,
  `maintenance_request_id` VARCHAR(36) NOT NULL,
  `commission_percentage` DECIMAL(5, 2) NOT NULL,
  `total_payment_amount` DECIMAL(12, 2) NOT NULL COMMENT 'Total amount facility paid',
  `commission_amount` DECIMAL(12, 2) NOT NULL COMMENT 'Calculated commission',
  `currency` VARCHAR(10) DEFAULT 'TZS',
  `commission_status` ENUM('pending', 'earned', 'withdrawn') NOT NULL DEFAULT 'earned',
  `earned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `withdrawn_at` DATETIME NULL,
  `withdrawal_id` VARCHAR(36) NULL COMMENT 'Link to withdrawal if withdrawn',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `technician_commission_technician_idx` (`technician_id`),
  INDEX `technician_commission_request_idx` (`maintenance_request_id`),
  INDEX `technician_commission_status_idx` (`commission_status`),
  INDEX `technician_commission_earned_idx` (`earned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
