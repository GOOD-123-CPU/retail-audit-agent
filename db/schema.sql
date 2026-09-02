CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_login_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  owner_id VARCHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  company_name VARCHAR(191) NOT NULL,
  fiscal_year VARCHAR(16) NOT NULL,
  industry VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  summary TEXT NOT NULL,
  risk_count INT NOT NULL DEFAULT 0,
  high_risk_count INT NOT NULL DEFAULT 0,
  payload_json LONGTEXT NOT NULL,
  report_markdown LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_projects_owner_id (owner_id),
  INDEX idx_projects_updated_at (updated_at)
);

CREATE TABLE IF NOT EXISTS rule_configs (
  id VARCHAR(64) PRIMARY KEY,
  risk_code VARCHAR(128) NOT NULL UNIQUE,
  title VARCHAR(191) NOT NULL,
  category VARCHAR(128) NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  config_json LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS vector_chunks (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  record_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(191) NOT NULL,
  chunk_index INT NOT NULL,
  content_text LONGTEXT NOT NULL,
  embedding_json LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_vector_chunks_project_id (project_id),
  INDEX idx_vector_chunks_record_id (record_id)
);

CREATE TABLE IF NOT EXISTS workpaper_templates (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  description TEXT NOT NULL,
  scope_type VARCHAR(64) NOT NULL,
  template_markdown LONGTEXT NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS workpapers (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  title VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL,
  generated_markdown LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_workpapers_project_id (project_id),
  INDEX idx_workpapers_template_id (template_id)
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL,
  submitted_by VARCHAR(64) NOT NULL,
  submitted_at DATETIME NULL,
  reviewed_by VARCHAR(64) NULL,
  reviewed_at DATETIME NULL,
  current_step VARCHAR(64) NOT NULL,
  comment TEXT NOT NULL,
  history_json LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_approval_requests_status (status)
);
