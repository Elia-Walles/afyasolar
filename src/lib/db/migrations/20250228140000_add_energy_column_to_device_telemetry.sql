-- Add energy column to device_telemetry table
ALTER TABLE device_telemetry ADD COLUMN energy DECIMAL(12, 2) DEFAULT NULL COMMENT 'Energy consumption in kWh';
