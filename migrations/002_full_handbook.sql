-- 002_full_handbook.sql — Extended schema for complete Batch B Handbook support

-- Update users table check constraint to support all 6 roles
PRAGMA foreign_keys=off;
CREATE TABLE IF NOT EXISTS users_new (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('operator','administrator','supervisor','quality_engineer','maintenance_engineer','auditor')),
  created_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO users_new (user_id, username, password_hash, role, created_at)
SELECT user_id, username, password_hash, role, created_at FROM users;
DROP TABLE IF EXISTS users;
ALTER TABLE users_new RENAME TO users;
PRAGMA foreign_keys=on;

-- Shifts definition (B5)
CREATE TABLE IF NOT EXISTS shifts (
  shift_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,  -- e.g. '06:00'
  end_time TEXT NOT NULL,    -- e.g. '14:00'
  date TEXT,
  timezone TEXT DEFAULT 'UTC'
);

-- Production batches / work orders (B5)
CREATE TABLE IF NOT EXISTS batches (
  batch_id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  planned_quantity INTEGER NOT NULL,
  line_id TEXT REFERENCES lines(line_id),
  start_time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('planned', 'active', 'completed', 'halted'))
);

-- Target definitions (rates and quantities)
CREATE TABLE IF NOT EXISTS targets (
  target_id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id TEXT REFERENCES lines(line_id),
  shift_id TEXT REFERENCES shifts(shift_id),
  batch_id TEXT REFERENCES batches(batch_id),
  target_quantity INTEGER,
  target_rate_per_hour REAL,
  effective_from TEXT,
  created_by TEXT
);

-- Audited corrections for immutable raw events (B8)
CREATE TABLE IF NOT EXISTS corrections (
  correction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES count_events(event_id),
  type TEXT NOT NULL,          -- 'void', 'reclassify', 'quantity_adjust'
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  requested_at TEXT NOT NULL,
  approved_at TEXT,
  previous_status TEXT,
  new_status TEXT
);

-- Configuration versions for edge devices (B7)
CREATE TABLE IF NOT EXISTS configuration_versions (
  config_id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  version TEXT NOT NULL,
  payload TEXT NOT NULL,       -- JSON containing ROI, direction, thresholds, model
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'deprecated')),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT
);

-- Edge remote commands queue (Handbook Page 7)
CREATE TABLE IF NOT EXISTS device_commands (
  command_id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  command_type TEXT NOT NULL,  -- e.g. 'reset_diagnostics', 'reload_config', 'restart_service'
  payload TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'acknowledged', 'failed')),
  created_at TEXT NOT NULL,
  acknowledged_at TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_corrections_event ON corrections(event_id);
CREATE INDEX IF NOT EXISTS idx_configs_device ON configuration_versions(device_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_device ON device_commands(device_id, status);
CREATE INDEX IF NOT EXISTS idx_batches_line ON batches(line_id);
