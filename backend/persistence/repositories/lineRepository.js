const { db } = require('../db');

module.exports = {
  /**
   * Finds a line by ID.
   * @param {string} lineId 
   * @returns {object|undefined}
   */
  findById(lineId) {
    return db.prepare('SELECT * FROM lines WHERE line_id = ?').get(lineId);
  },

  /**
   * Retrieves all lines.
   * @returns {Array}
   */
  findAll() {
    return db.prepare('SELECT * FROM lines').all();
  },

  /**
   * Inserts a new line.
   * @param {object} line 
   */
  insert(line) {
    db.prepare('INSERT INTO lines (line_id, name, location) VALUES (?, ?, ?)')
      .run(line.line_id, line.name, line.location);
  },

  /**
   * Updates an existing line.
   * @param {string} lineId 
   * @param {object} fields 
   */
  update(lineId, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
    if (sets.length > 0) {
      params.push(lineId);
      db.prepare(`UPDATE lines SET ${sets.join(', ')} WHERE line_id = ?`).run(...params);
    }
  }
};
