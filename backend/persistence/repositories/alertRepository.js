const { db } = require('../db');

module.exports = {
  /**
   * Inserts a new alert.
   * @param {object} alert
   * @returns {object} inserted alert with alert_id
   */
  insert(alert) {
    const info = db.prepare(`
      INSERT INTO alerts (severity, rule, source_device_id, raised_at)
      VALUES (?, ?, ?, ?)
    `).run(
      alert.severity || 'warning',
      alert.rule,
      alert.source_device_id,
      alert.raised_at || new Date().toISOString()
    );
    return db.prepare('SELECT * FROM alerts WHERE alert_id = ?').get(info.lastInsertRowid);
  },

  /**
   * Finds alerts based on state.
   * @param {object} params - { state: 'active'|'acknowledged'|'cleared' }
   * @returns {Array}
   */
  findAll({ state } = {}) {
    let query = 'SELECT * FROM alerts';
    if (state === 'active') {
      query += ' WHERE acknowledged_at IS NULL AND cleared_at IS NULL';
    } else if (state === 'acknowledged') {
      query += ' WHERE acknowledged_at IS NOT NULL AND cleared_at IS NULL';
    } else if (state === 'cleared') {
      query += ' WHERE cleared_at IS NOT NULL';
    }
    query += ' ORDER BY raised_at DESC';
    return db.prepare(query).all();
  },

  /**
   * Acknowledges an alert.
   * @param {number} alertId
   * @param {string} username
   */
  acknowledge(alertId, username) {
    db.prepare(`
      UPDATE alerts 
      SET acknowledged_at = datetime('now'), acknowledged_by = ? 
      WHERE alert_id = ?
    `).run(username || 'system', alertId);
  },

  /**
   * Clears an alert.
   * @param {number} alertId
   */
  clear(alertId) {
    db.prepare(`
      UPDATE alerts 
      SET cleared_at = datetime('now') 
      WHERE alert_id = ?
    `).run(alertId);
  },

  /**
   * Finds an active (uncleared) alert for a specific device and rule.
   * Returns a single row or undefined.
   * @param {string} deviceId
   * @param {string} rule
   * @returns {object|undefined}
   */
  findActiveByDeviceAndRule(deviceId, rule) {
    return db.prepare(`
      SELECT * FROM alerts 
      WHERE source_device_id = ? AND rule = ? AND cleared_at IS NULL
    `).get(deviceId, rule);
  }
};
