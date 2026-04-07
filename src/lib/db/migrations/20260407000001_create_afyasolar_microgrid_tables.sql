-- Microgrid + tariffs + meter readings (design-to-prod additions)

CREATE TABLE IF NOT EXISTS `afyasolar_facility_tariffs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `facility_id` varchar(36) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'TZS',
  `price_per_kwh` decimal(12,2) NOT NULL,
  `peak_price_per_kwh` decimal(12,2) NULL,
  `off_peak_price_per_kwh` decimal(12,2) NULL,
  `minimum_top_up` decimal(12,2) NULL,
  `connection_fee` decimal(12,2) NULL,
  `effective_from` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `effective_to` timestamp NULL,
  `is_active` tinyint NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mg_tariff_facility` (`facility_id`),
  KEY `idx_mg_tariff_active` (`is_active`, `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `afyasolar_microgrid_facilities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `facility_id` varchar(36) NOT NULL,
  `name` varchar(150) NOT NULL,
  `export_capacity_kw` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tariff_id` bigint unsigned NULL,
  `status` varchar(30) NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mg_facility_facility` (`facility_id`),
  KEY `idx_mg_facility_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `afyasolar_microgrid_consumers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `microgrid_facility_id` bigint unsigned NOT NULL,
  `consumer_code` varchar(80) NOT NULL,
  `name` varchar(150) NOT NULL,
  `type` varchar(40) NOT NULL,
  `smartmeter_id` bigint unsigned NULL,
  `phone_number` varchar(30) NULL,
  `address` varchar(255) NULL,
  `tariff_rate` decimal(12,2) NOT NULL,
  `credit_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `outstanding_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `status` varchar(30) NOT NULL DEFAULT 'ACTIVE',
  `connected_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_payment_at` timestamp NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mg_consumer_code` (`consumer_code`),
  KEY `idx_mg_consumer_facility` (`microgrid_facility_id`),
  KEY `idx_mg_consumer_meter` (`smartmeter_id`),
  KEY `idx_mg_consumer_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `afyasolar_microgrid_usage_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `consumer_id` bigint unsigned NOT NULL,
  `occurred_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `energy_kwh` decimal(12,4) NOT NULL,
  `cost_tzs` decimal(14,2) NOT NULL,
  `payment_status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mg_usage_consumer` (`consumer_id`, `occurred_at`),
  KEY `idx_mg_usage_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `afyasolar_meter_readings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `smartmeter_id` bigint unsigned NOT NULL,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `voltage` decimal(10,2) NULL,
  `current` decimal(10,2) NULL,
  `power` decimal(12,2) NULL,
  `energy` decimal(14,3) NULL,
  `power_factor` decimal(6,3) NULL,
  `relay_status` varchar(10) NULL,
  `credit_balance` decimal(14,2) NULL,
  `status` varchar(20) NULL DEFAULT 'unknown',
  `raw_payload` text NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_meter_readings_meter` (`smartmeter_id`, `recorded_at`),
  KEY `idx_meter_readings_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `afyasolar_relay_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `smartmeter_id` bigint unsigned NOT NULL,
  `client_service_id` bigint unsigned NULL,
  `action` varchar(10) NOT NULL,
  `requested_by_user_id` varchar(36) NULL,
  `reason_code` varchar(30) NULL,
  `reason_text` varchar(255) NULL,
  `result` varchar(20) NOT NULL DEFAULT 'queued',
  `error_message` varchar(255) NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_relay_actions_meter` (`smartmeter_id`, `created_at`),
  KEY `idx_relay_actions_result` (`result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

