-- Create technician_withdrawals table
CREATE TABLE IF NOT EXISTS `technician_withdrawals` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `technician_id` VARCHAR(36) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(10) DEFAULT 'TZS',
  `withdrawal_method` VARCHAR(50) NULL COMMENT 'mpesa, bank_transfer, etc.',
  `account_details` TEXT NULL COMMENT 'JSON string with account info',
  `withdrawal_status` ENUM('pending', 'processing', 'completed', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `admin_notes` TEXT NULL,
  `processed_at` DATETIME NULL,
  `processed_by` VARCHAR(36) NULL COMMENT 'Admin user ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `technician_withdrawal_technician_idx` (`technician_id`),
  INDEX `technician_withdrawal_status_idx` (`withdrawal_status`),
  INDEX `technician_withdrawal_created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
