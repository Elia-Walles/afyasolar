CREATE TABLE IF NOT EXISTS maintenance_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  user_email VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255),
  details JSON,
  ip_address VARCHAR(100),
  user_agent VARCHAR(255),
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX maintenance_audit_logs_user_idx ON maintenance_audit_logs(user_id);
CREATE INDEX maintenance_audit_logs_resource_idx ON maintenance_audit_logs(resource);
CREATE INDEX maintenance_audit_logs_created_idx ON maintenance_audit_logs(created_at);

