const { db } = require('../db');

module.exports = {
  /**
   * Inserts an audited correction record.
   */
  create({ event_id, type = 'void', reason, requested_by, approved_by = null, previous_status = 'accepted', new_status = 'manually_voided' }) {
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO corrections (
        event_id, type, reason, requested_by, approved_by,
        requested_at, approved_at, previous_status, new_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event_id,
      type,
      reason,
      requested_by,
      approved_by || requested_by,
      now,
      now,
      previous_status,
      new_status
    );

    // Update count_events status while maintaining raw row immutability
    db.prepare('UPDATE count_events SET status = ? WHERE event_id = ?').run(new_status, event_id);

    return db.prepare('SELECT * FROM corrections WHERE correction_id = ?').get(info.lastInsertRowid);
  },

  /**
   * Lists all historical corrections with optional filter by event_id.
   */
  findAll({ event_id = null, limit = 100 } = {}) {
    if (event_id) {
      return db.prepare('SELECT * FROM corrections WHERE event_id = ? ORDER BY requested_at DESC LIMIT ?').all(event_id, limit);
    }
    return db.prepare('SELECT * FROM corrections ORDER BY requested_at DESC LIMIT ?').all(limit);
  },

  /**
   * Count total voided events.
   */
  countVoided() {
    const row = db.prepare("SELECT count(*) as total FROM count_events WHERE status = 'manually_voided'").get();
    return row ? row.total : 0;
  }
};
