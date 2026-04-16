CREATE TABLE IF NOT EXISTS assessment_cycle_energy_state (
  id VARCHAR(36) PRIMARY KEY,
  assessment_cycle_id VARCHAR(36) NOT NULL UNIQUE,
  facility_id VARCHAR(36) NOT NULL,
  sizing_data JSON,
  operations_data JSON,
  bmi_trend_json JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX aces_cycle_idx (assessment_cycle_id),
  INDEX aces_facility_idx (facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
