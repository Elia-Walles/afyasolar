-- Add logo_url column to facilities table
ALTER TABLE `facilities`
  ADD COLUMN IF NOT EXISTS `logo_url` VARCHAR(500) NULL AFTER `booking_settings`;
