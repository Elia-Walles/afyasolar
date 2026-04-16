CREATE TABLE IF NOT EXISTS facility_energy_assessments (
  id varchar(36) PRIMARY KEY,
  facility_id varchar(36) NOT NULL,
  assessment_cycle_id varchar(36) NULL,
  assessment_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  saved_by varchar(120) NULL,
  source_version varchar(20) NOT NULL DEFAULT '3.0',
  payload json NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX fea_facility_idx (facility_id),
  INDEX fea_cycle_idx (assessment_cycle_id),
  INDEX fea_date_idx (assessment_date)
);

CREATE TABLE IF NOT EXISTS facility_climate_assessments (
  id varchar(36) PRIMARY KEY,
  facility_id varchar(36) NOT NULL,
  assessment_cycle_id varchar(36) NULL,
  assessment_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  saved_by varchar(120) NULL,
  source_version varchar(20) NOT NULL DEFAULT '3.0',
  payload json NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX fca_facility_idx (facility_id),
  INDEX fca_cycle_idx (assessment_cycle_id),
  INDEX fca_date_idx (assessment_date)
);
