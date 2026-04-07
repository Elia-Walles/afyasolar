-- Create auth_login_events table for login analytics
CREATE TABLE IF NOT EXISTS `auth_login_events` (
  `id` varchar(36) NOT NULL,
  `entity_type` varchar(20) NOT NULL,
  `entity_id` varchar(36) NULL,
  `identifier` varchar(255) NOT NULL,
  `success` boolean NOT NULL,
  `failure_reason` varchar(255) NULL,
  `ip_address` varchar(100) NULL,
  `user_agent` text NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ale_entity_idx` (`entity_type`, `entity_id`),
  KEY `ale_identifier_idx` (`identifier`),
  KEY `ale_created_idx` (`created_at`),
  KEY `ale_success_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

