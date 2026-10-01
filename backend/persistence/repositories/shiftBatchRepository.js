const { db } = require('../db');

module.exports = {
  /**
   * Returns all defined shifts.
   */
  getShifts() {
    return db.prepare('SELECT * FROM shifts ORDER BY start_time ASC').all();
  },

  /**
   * Finds shift by ID.
   */
  findShiftById(shiftId) {
    return db.prepare('SELECT * FROM shifts WHERE shift_id = ?').get(shiftId);
  },

  /**
   * Returns all batches.
   */
  getBatches() {
    return db.prepare('SELECT * FROM batches ORDER BY batch_id DESC').all();
  },

  /**
   * Finds batch by ID.
   */
  findBatchById(batchId) {
    return db.prepare('SELECT * FROM batches WHERE batch_id = ?').get(batchId);
  },

  /**
   * Returns all targets.
   */
  getTargets() {
    return db.prepare('SELECT * FROM targets ORDER BY target_id DESC').all();
  },

  /**
   * Returns target for a line / shift combination.
   */
  findTargetForLineAndShift(lineId, shiftId) {
    return db.prepare(`
      SELECT * FROM targets 
      WHERE line_id = ? AND (shift_id = ? OR shift_id IS NULL)
      ORDER BY target_id DESC 
      LIMIT 1
    `).get(lineId, shiftId);
  },

  /**
   * Updates or inserts a production target.
   */
  upsertTarget({ line_id, shift_id = null, batch_id = null, target_quantity, target_rate_per_hour, created_by }) {
    const info = db.prepare(`
      INSERT INTO targets (line_id, shift_id, batch_id, target_quantity, target_rate_per_hour, effective_from, created_by)
      VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(line_id, shift_id, batch_id, target_quantity, target_rate_per_hour, created_by);

    return db.prepare('SELECT * FROM targets WHERE target_id = ?').get(info.lastInsertRowid);
  }
};
