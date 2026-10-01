const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { db } = require('./db');

/**
 * Runs pending migrations and seeds default data.
 */
function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
    }
  }

  // Seed default users covering the full 6-role matrix if missing
  const seedUser = (username, password, role) => {
    const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    if (!exists) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
        .run(username, hash, role);
      console.log(`Seeded user: ${username} (${role})`);
    }
  };

  seedUser('admin', 'admin123', 'administrator');
  seedUser('operator', 'operator123', 'operator');
  seedUser('supervisor', 'supervisor123', 'supervisor');
  seedUser('quality', 'quality123', 'quality_engineer');
  seedUser('maintenance', 'maint123', 'maintenance_engineer');
  seedUser('auditor', 'auditor123', 'auditor');

  // Seed default lines if empty
  const linesCount = db.prepare('SELECT count(*) as count FROM lines').get().count;
  if (linesCount === 0) {
    const insertLine = db.prepare('INSERT INTO lines (line_id, name, location) VALUES (?, ?, ?)');
    insertLine.run('line-1', 'Line Alpha', 'Building A');
    insertLine.run('line-2', 'Line Beta', 'Building B');
    console.log('Seeded default lines.');
  }

  // Seed default devices if empty
  const devicesCount = db.prepare('SELECT count(*) as count FROM devices').get().count;
  if (devicesCount === 0) {
    const insertDevice = db.prepare('INSERT INTO devices (device_id, line_id, status) VALUES (?, ?, ?)');
    insertDevice.run('dev-001', 'line-1', 'online');
    insertDevice.run('dev-002', 'line-1', 'online');
    insertDevice.run('dev-003', 'line-2', 'online');
    console.log('Seeded default devices.');
  }

  // Seed shifts if empty
  const shiftsCount = db.prepare('SELECT count(*) as count FROM shifts').get().count;
  if (shiftsCount === 0) {
    const insertShift = db.prepare('INSERT INTO shifts (shift_id, name, start_time, end_time, timezone) VALUES (?, ?, ?, ?, ?)');
    insertShift.run('SHIFT-1', 'Morning Shift (06:00 - 14:00)', '06:00', '14:00', 'UTC');
    insertShift.run('SHIFT-2', 'Afternoon Shift (14:00 - 22:00)', '14:00', '22:00', 'UTC');
    insertShift.run('SHIFT-3', 'Night Shift (22:00 - 06:00)', '22:00', '06:00', 'UTC');
    console.log('Seeded default shifts.');
  }

  // Seed batches if empty
  const batchesCount = db.prepare('SELECT count(*) as count FROM batches').get().count;
  if (batchesCount === 0) {
    const insertBatch = db.prepare('INSERT INTO batches (batch_id, product, planned_quantity, line_id, status) VALUES (?, ?, ?, ?, ?)');
    insertBatch.run('BATCH-260730-A', 'Bearing Cap Standard', 1000, 'line-1', 'active');
    insertBatch.run('BATCH-260730-B', 'Gasket Ring High-Temp', 500, 'line-2', 'active');
    console.log('Seeded default batches.');
  }

  // Seed targets if empty
  const targetsCount = db.prepare('SELECT count(*) as count FROM targets').get().count;
  if (targetsCount === 0) {
    const insertTarget = db.prepare('INSERT INTO targets (line_id, shift_id, batch_id, target_quantity, target_rate_per_hour, created_by) VALUES (?, ?, ?, ?, ?, ?)');
    insertTarget.run('line-1', 'SHIFT-1', 'BATCH-260730-A', 1000, 125.0, 'supervisor');
    insertTarget.run('line-2', 'SHIFT-1', 'BATCH-260730-B', 500, 62.5, 'supervisor');
    console.log('Seeded default targets.');
  }

  // Seed baseline approved configuration versions for devices
  const configsCount = db.prepare('SELECT count(*) as count FROM configuration_versions').get().count;
  if (configsCount === 0) {
    const insertConfig = db.prepare(`
      INSERT INTO configuration_versions (device_id, version, payload, status, created_by, approved_by, created_at, approved_at)
      VALUES (?, ?, ?, 'approved', 'admin', 'supervisor', datetime('now'), datetime('now'))
    `);

    const defaultPayload = JSON.stringify({
      roi: { x_min: 120, y_min: 80, x_max: 520, y_max: 400 },
      crossing_line: { y: 240, direction: 'forward' },
      confidence_threshold: 0.85,
      model_version: 'parts-yolo-1.3.0',
      min_track_duration_ms: 100
    }, null, 2);

    insertConfig.run('dev-001', '1.0.0', defaultPayload);
    insertConfig.run('dev-002', '1.0.0', defaultPayload);
    insertConfig.run('dev-003', '1.0.0', defaultPayload);
    console.log('Seeded baseline device configurations.');
  }
}

if (require.main === module) {
  runMigrations();
  console.log('Migrations complete.');
  process.exit(0);
}

module.exports = {
  runMigrations
};
