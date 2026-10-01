-- 001_init.sql — Initial schema for Dashboard Platform
-- Run via: node backend/persistence/migrate.js

-- Production lines
CREATE TABLE IF NOT EXISTS lines (
  line_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  timezone TEXT DEFAULT 'UTC',
  enabled INTEGER DEFAULT 1
);

-- Edge devices
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  display_name TEXT,
  line_id TEXT REFERENCES lines(line_id),
  app_version TEXT,
  model_version TEXT,
  last_seen TEXT,
  status TEXT DEFAULT 'offline' CHECK(status IN ('online','stale','offline'))
);

-- Count events — IMMUTABLE, never UPDATE or DELETE
CREATE TABLE IF NOT EXISTS count_events (
  event_id TEXT PRIMARY KEY,
  schema_version TEXT DEFAULT '1.0',
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  line_id TEXT REFERENCES lines(line_id),
  event_sequence INTEGER,
  event_time TEXT NOT NULL,
  received_time TEXT NOT NULL,
  part_class TEXT,
  quantity INTEGER DEFAULT 1,
  confidence REAL,
  track_id TEXT,
  direction TEXT,
  batch_id TEXT,
  shift_id TEXT,
  image_reference TEXT,
  model_version TEXT,
  processing_latency_ms INTEGER,
  status TEXT DEFAULT 'accepted' CHECK(status IN ('accepted','suspected','manually_voided'))
);

-- Health telemetry
CREATE TABLE IF NOT EXISTS health_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  timestamp TEXT NOT NULL,
  service_status TEXT,
  camera_status TEXT,
  fps REAL,
  inference_latency_ms INTEGER,
  cpu_percent REAL,
  memory_percent REAL,
  temperature_c REAL,
  queue_depth INTEGER,
  last_event_time TEXT,
  model_version TEXT,
  app_version TEXT,
  error_code TEXT,
  message TEXT
);

-- Users and auth
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('operator','administrator')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info','warning','critical')),
  rule TEXT NOT NULL,
  source_device_id TEXT REFERENCES devices(device_id),
  raised_at TEXT NOT NULL,
  acknowledged_at TEXT,
  cleared_at TEXT,
  acknowledged_by TEXT
);

-- Audit trail — every significant action is logged here from day 1
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  request_id TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  detail TEXT
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_count_events_device ON count_events(device_id);
CREATE INDEX IF NOT EXISTS idx_count_events_line ON count_events(line_id);
CREATE INDEX IF NOT EXISTS idx_count_events_time ON count_events(event_time);
CREATE INDEX IF NOT EXISTS idx_count_events_status ON count_events(status);
CREATE INDEX IF NOT EXISTS idx_health_device ON health_samples(device_id);
CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_samples(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_state ON alerts(acknowledged_at, cleared_at);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
