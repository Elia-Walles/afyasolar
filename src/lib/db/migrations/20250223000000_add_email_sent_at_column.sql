-- Add email_sent_at column to admin_notifications table
-- This fixes the issue where the notification system tries to use email_sent_at but the column doesn't exist

ALTER TABLE admin_notifications 
ADD COLUMN email_sent_at DATETIME NULL DEFAULT NULL AFTER email_error;

-- Update any existing records to set email_sent_at based on email_error
-- If email_error is NULL and email_sent_at is NULL, set email_sent_at to created_at for existing records
UPDATE admin_notifications 
SET email_sent_at = created_at 
WHERE email_sent_at IS NULL AND email_error IS NULL;
