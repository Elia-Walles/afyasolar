-- Create refurbishment_job_comments table
CREATE TABLE IF NOT EXISTS `refurbishment_job_comments` (
  `id` VARCHAR(36) PRIMARY KEY,
  `refurbishment_job_id` VARCHAR(36) NOT NULL,
  `author_id` VARCHAR(36) NOT NULL,
  `author_name` VARCHAR(255) NOT NULL,
  `author_role` ENUM('admin', 'technician') NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `refurb_comment_job_idx` (`refurbishment_job_id`),
  INDEX `refurb_comment_author_idx` (`author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

