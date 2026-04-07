-- Maintenance Plan Requests Workflow Tables
-- This migration creates tables for the new maintenance plan request workflow

-- 1. Maintenance Plan Requests
CREATE TABLE IF NOT EXISTS `maintenance_plan_requests` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `facility_id` VARCHAR(36) NOT NULL,
  `request_number` VARCHAR(50) NOT NULL UNIQUE,
  `request_status` ENUM('pending', 'technician_assigned', 'evaluation_in_progress', 'proposal_submitted', 'admin_approved', 'facility_approved', 'facility_rejected', 'payment_pending', 'payment_confirmed', 'active', 'cancelled') NOT NULL DEFAULT 'pending',
  `assigned_technician_id` VARCHAR(36) NULL,
  `assigned_at` DATETIME NULL,
  `proposal_submitted_at` DATETIME NULL,
  `admin_approved_at` DATETIME NULL,
  `admin_approved_by` VARCHAR(36) NULL,
  `facility_approved_at` DATETIME NULL,
  `facility_rejected_at` DATETIME NULL,
  `facility_rejection_reason` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `maintenance_plan_requests_facility_idx` (`facility_id`),
  INDEX `maintenance_plan_requests_technician_idx` (`assigned_technician_id`),
  INDEX `maintenance_plan_requests_status_idx` (`request_status`),
  INDEX `maintenance_plan_requests_number_idx` (`request_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Maintenance Plan Request Equipment
CREATE TABLE IF NOT EXISTS `maintenance_plan_request_equipment` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `request_id` VARCHAR(36) NOT NULL,
  `equipment_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `maintenance_plan_request_equipment_request_idx` (`request_id`),
  INDEX `maintenance_plan_request_equipment_equipment_idx` (`equipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Maintenance Plan Proposals
CREATE TABLE IF NOT EXISTS `maintenance_plan_proposals` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `request_id` VARCHAR(36) NOT NULL,
  `technician_id` VARCHAR(36) NOT NULL,
  `total_cost` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(10) DEFAULT 'TZS',
  `proposal_notes` TEXT NULL,
  `proposal_status` ENUM('draft', 'submitted', 'admin_approved', 'admin_rejected', 'facility_approved', 'facility_rejected') NOT NULL DEFAULT 'draft',
  `submitted_at` DATETIME NULL,
  `admin_approved_at` DATETIME NULL,
  `admin_approved_by` VARCHAR(36) NULL,
  `admin_rejection_reason` TEXT NULL,
  `facility_approved_at` DATETIME NULL,
  `facility_rejected_at` DATETIME NULL,
  `facility_rejection_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `maintenance_plan_proposals_request_idx` (`request_id`),
  INDEX `maintenance_plan_proposals_technician_idx` (`technician_id`),
  INDEX `maintenance_plan_proposals_status_idx` (`proposal_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Maintenance Plan Proposal Items
CREATE TABLE IF NOT EXISTS `maintenance_plan_proposal_items` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `proposal_id` VARCHAR(36) NOT NULL,
  `equipment_id` VARCHAR(36) NOT NULL,
  `maintenance_type` ENUM('preventive', 'corrective', 'inspection', 'calibration', 'full_service') NOT NULL,
  `schedule_type` ENUM('per_year', 'per_service', 'monthly', 'quarterly', 'custom') NOT NULL,
  `visits_per_year` INT NULL,
  `price_per_service` DECIMAL(12, 2) NULL,
  `price_per_year` DECIMAL(12, 2) NULL,
  `total_cost` DECIMAL(12, 2) NOT NULL,
  `duration_months` INT NULL,
  `start_date` DATETIME NULL,
  `end_date` DATETIME NULL,
  `includes_parts` BOOLEAN NOT NULL DEFAULT false,
  `includes_emergency_support` BOOLEAN NOT NULL DEFAULT false,
  `response_time_hours` INT NULL,
  `description` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `maintenance_plan_proposal_items_proposal_idx` (`proposal_id`),
  INDEX `maintenance_plan_proposal_items_equipment_idx` (`equipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Maintenance Plan Payments
CREATE TABLE IF NOT EXISTS `maintenance_plan_payments` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `proposal_id` VARCHAR(36) NOT NULL,
  `request_id` VARCHAR(36) NOT NULL,
  `facility_id` VARCHAR(36) NOT NULL,
  `payment_type` ENUM('half', 'full') NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `total_amount` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(10) DEFAULT 'TZS',
  `payment_method` VARCHAR(50) NULL,
  `transaction_id` VARCHAR(255) NULL,
  `payment_status` ENUM('pending', 'paid', 'confirmed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `paid_at` DATETIME NULL,
  `confirmed_at` DATETIME NULL,
  `confirmed_by` VARCHAR(36) NULL,
  `admin_notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `maintenance_plan_payments_proposal_idx` (`proposal_id`),
  INDEX `maintenance_plan_payments_request_idx` (`request_id`),
  INDEX `maintenance_plan_payments_facility_idx` (`facility_id`),
  INDEX `maintenance_plan_payments_status_idx` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
