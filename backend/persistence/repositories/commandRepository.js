const { db } = require('../db');

module.exports = {
  /**
   * Retrieves pending commands for an edge device.
   */
  getPending(deviceId) {
    return db.prepare(`
      SELECT * FROM device_commands 
      WHERE device_id = ? AND status = 'pending'
      ORDER BY command_id ASC
    `).all(deviceId);
  },

  /**
   * Enqueues a command for an edge device.
   */
  enqueue({ device_id, command_type, payload = null }) {
    const now = new Date().toISOString();
    const payloadStr = payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;
    const info = db.prepare(`
      INSERT INTO device_commands (device_id, command_type, payload, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(device_id, command_type, payloadStr, now);

    return db.prepare('SELECT * FROM device_commands WHERE command_id = ?').get(info.lastInsertRowid);
  },

  /**
   * Acknowledges that a command was executed by the edge device.
   */
  acknowledge(commandId) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE device_commands 
      SET status = 'acknowledged', acknowledged_at = ? 
      WHERE command_id = ?
    `).run(now, commandId);

    return db.prepare('SELECT * FROM device_commands WHERE command_id = ?').get(commandId);
  },

  /**
   * Returns recent command execution history.
   */
  findAll(limit = 50) {
    return db.prepare('SELECT * FROM device_commands ORDER BY command_id DESC LIMIT ?').all(limit);
  }
};
