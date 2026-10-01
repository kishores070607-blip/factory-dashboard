const { db } = require('../db');

module.exports = {
  /**
   * Retrieves the current approved operational configuration for a device.
   */
  getApproved(deviceId) {
    return db.prepare(`
      SELECT * FROM configuration_versions 
      WHERE device_id = ? AND status = 'approved'
      ORDER BY approved_at DESC, config_id DESC 
      LIMIT 1
    `).get(deviceId);
  },

  /**
   * Lists all configuration versions (drafts and approvals) for a device.
   */
  listVersions(deviceId = null) {
    if (deviceId) {
      return db.prepare('SELECT * FROM configuration_versions WHERE device_id = ? ORDER BY config_id DESC').all(deviceId);
    }
    return db.prepare('SELECT * FROM configuration_versions ORDER BY config_id DESC').all();
  },

  /**
   * Creates a new configuration version draft.
   */
  createDraft({ device_id, version, payload, created_by }) {
    const now = new Date().toISOString();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const info = db.prepare(`
      INSERT INTO configuration_versions (
        device_id, version, payload, status, created_by, created_at
      ) VALUES (?, ?, ?, 'draft', ?, ?)
    `).run(device_id, version, payloadStr, created_by, now);

    return db.prepare('SELECT * FROM configuration_versions WHERE config_id = ?').get(info.lastInsertRowid);
  },

  /**
   * Approves a configuration version.
   */
  approve(configId, approvedBy) {
    const now = new Date().toISOString();
    const config = db.prepare('SELECT * FROM configuration_versions WHERE config_id = ?').get(configId);
    if (!config) return null;

    // Deprecate previous approved configs for this device
    db.prepare(`
      UPDATE configuration_versions 
      SET status = 'deprecated' 
      WHERE device_id = ? AND status = 'approved'
    `).run(config.device_id);

    // Promote target config to approved
    db.prepare(`
      UPDATE configuration_versions 
      SET status = 'approved', approved_by = ?, approved_at = ? 
      WHERE config_id = ?
    `).run(approvedBy, now, configId);

    return db.prepare('SELECT * FROM configuration_versions WHERE config_id = ?').get(configId);
  }
};
