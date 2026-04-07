-- Add access_code column to appointments table for patient login
ALTER TABLE `appointments`
ADD COLUMN IF NOT EXISTS `access_code` VARCHAR(6) NULL AFTER `appointment_number`;

-- Add index for faster lookups
ALTER TABLE `appointments`
ADD INDEX IF NOT EXISTS `appointment_access_code_idx` (`access_code`);

-- Update existing appointments to have access codes (last 6 chars of appointment_number)
UPDATE `appointments`
SET `access_code` = UPPER(RIGHT(`appointment_number`, 6))
WHERE `access_code` IS NULL;
