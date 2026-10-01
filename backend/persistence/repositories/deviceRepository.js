const { db } = require('../db');

module.exports = {
  /**
   * Finds a device by ID.
   * @param {string} deviceId 
   * @returns {object|undefined}
   */
  findById(deviceId) {
    return db.prepare('SELECT * FROM devices WHERE device_id = ?').get(deviceId);
  },

  /**
   * Retrieves all devices.
   * @returns {Array}
   */
  findAll() {
    return db.prepare('SELECT * FROM devices').all();
  },

  /**
   * Retrieves devices for a given line.
   * @param {string} lineId 
   * @returns {Array}
   */
  findByLine(lineId) {
    return db.prepare('SELECT * FROM devices WHERE line_id = ?').all(lineId);
  },

  /**
   * Inserts or replaces a device.
   * @param {object} device 
   */
  upsert(device) {
    db.prepare(`
      INSERT OR REPLACE INTO devices (device_id, line_id, status, last_seen)
      VALUES (?, ?, ?, COALESCE(?, datetime('now')))
    `).run(device.device_id, device.line_id, device.status || 'unknown', device.last_seen);
  },

  /**
   * Updates device status and last seen timestamp.
   * @param {string} deviceId 
   * @param {string} status 
   * @param {string} lastSeen 
   */
  updateStatus(deviceId, status, lastSeen) {
    db.prepare(`
      UPDATE devices 
      SET status = ?, last_seen = ? 
      WHERE device_id = ?
    `).run(status, lastSeen || new Date().toISOString(), deviceId);
  },

  /**
   * Finds stale devices based on thresholds.
   * @param {number} staleThresholdS 
   * @param {number} offlineThresholdS 
   * @returns {Array}
   */
  findStale(staleThresholdS, offlineThresholdS) {
    return db.prepare(`
      SELECT * FROM devices
      WHERE last_seen < datetime('now', '-' || ? || ' seconds')
    `).all(Math.min(staleThresholdS, offlineThresholdS));
  }
};
