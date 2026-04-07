-- Afya Solar: per-facility Design & Finance engine reports
CREATE TABLE IF NOT EXISTS `afyasolar_design_reports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `facility_id` VARCHAR(36) NULL,
  `facility_name` VARCHAR(150) NULL,
  `pv_size_kw` DECIMAL(8,2) NULL,
  `battery_kwh` DECIMAL(10,2) NULL,
  `gross_monthly_savings` BIGINT NULL,
  `payload_json` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_design_reports_facility` (`facility_id`, `created_at`),
  KEY `idx_design_reports_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

