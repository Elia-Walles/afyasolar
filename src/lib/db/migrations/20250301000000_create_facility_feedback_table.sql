-- Create facility_feedback table for patient feedback after appointments
CREATE TABLE IF NOT EXISTS `facility_feedback` (
  `id` VARCHAR(36) PRIMARY KEY,
  `facility_id` VARCHAR(36) NOT NULL,
  `appointment_id` VARCHAR(36) NULL,
  `feedback_number` VARCHAR(255) NOT NULL UNIQUE,
  `user_role` ENUM('patient', 'visitor', 'relative', 'caregiver') NOT NULL,
  `phone_number` VARCHAR(255) NULL,
  `service_department` VARCHAR(255) NULL,
  `feedback_types` TEXT NOT NULL COMMENT 'JSON array: ["compliment", "suggestion", "complaint", "general"]',
  `detailed_feedback` TEXT NOT NULL,
  `ratings` TEXT NULL COMMENT 'JSON object for dynamic ratings',
  -- Static rating columns for backward compatibility
  `overall_experience` INT NULL,
  `staff_friendliness` INT NULL,
  `wait_time` INT NULL,
  `cleanliness` INT NULL,
  `communication` INT NULL,
  `treatment_quality` INT NULL,
  `facility_comfort` INT NULL,
  -- Status and management
  `is_attended` TINYINT(1) NOT NULL DEFAULT 0,
  `internal_notes` TEXT NULL,
  `attended_at` DATETIME NULL,
  `attended_by` VARCHAR(36) NULL,
  -- Tracking
  `ip_address` VARCHAR(255) NULL,
  `user_agent` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `feedback_facility_idx` (`facility_id`),
  INDEX `feedback_appointment_idx` (`appointment_id`),
  INDEX `feedback_number_idx` (`feedback_number`),
  INDEX `feedback_is_attended_idx` (`is_attended`),
  FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
