-- Add password reset fields to users table if they don't exist
-- MySQL doesn't support IF NOT EXISTS for ALTER TABLE, so we need to check first

-- Check and add password_reset_token column
SET @col_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'password_reset_token'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `password_reset_token` varchar(255) NULL',
  'SELECT "Column password_reset_token already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add password_reset_expires column
SET @col_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'password_reset_expires'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `password_reset_expires` datetime NULL',
  'SELECT "Column password_reset_expires already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add password_reset_token_idx index
SET @idx_exists = (
  SELECT COUNT(*) 
  FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users' 
  AND INDEX_NAME = 'password_reset_token_idx'
);

SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX `password_reset_token_idx` ON `users` (`password_reset_token`)',
  'SELECT "Index password_reset_token_idx already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

