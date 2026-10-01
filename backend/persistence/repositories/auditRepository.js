const { db } = require('../db');

module.exports = {
  /**
   * Inserts an audit log entry.
   * @param {object} log 
   */
  insert({ actor, action, objectType, objectId, requestId, detail }) {
    db.prepare(`
      INSERT INTO audit_log (actor, action, object_type, object_id, request_id, detail, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(actor, action, objectType, objectId, requestId, detail ? JSON.stringify(detail) : null);
  },

  /**
   * Retrieves recent audit logs.
   * @param {number} limit 
   * @returns {Array}
   */
  findRecent(limit = 100) {
    return db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?').all(limit);
  }
};
