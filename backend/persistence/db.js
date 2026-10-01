const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'dashboard.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/**
 * Closes the database connection.
 */
function close() {
  db.close();
}

/**
 * Checks if the database connection is healthy.
 * @returns {boolean} True if healthy, false otherwise.
 */
function checkConnection() {
  try {
    const row = db.prepare('SELECT 1 as val').get();
    return row.val === 1;
  } catch (err) {
    return false;
  }
}

module.exports = {
  db,
  close,
  checkConnection
};
