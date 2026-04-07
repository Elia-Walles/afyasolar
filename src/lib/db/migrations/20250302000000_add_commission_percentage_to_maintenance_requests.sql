-- Add commission_percentage column to maintenance_requests table
ALTER TABLE `maintenance_requests`
ADD COLUMN `commission_percentage` DECIMAL(5, 2) NULL COMMENT 'Commission percentage (0-100)' AFTER `assigned_technician_id`;
