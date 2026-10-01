const { db } = require('../db');

module.exports = {
  /**
   * Finds a user by username.
   * @param {string} username 
   * @returns {object|undefined}
   */
  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  /**
   * Finds a user by ID.
   * @param {number} userId 
   * @returns {object|undefined}
   */
  findById(userId) {
    return db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  },

  /**
   * Inserts a new user.
   * @param {object} user 
   * @returns {object} inserted user without password hash
   */
  insert(user) {
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, ?)
    `).run(user.username, user.password_hash, user.role || 'operator');
    return this.findById(info.lastInsertRowid);
  },

  /**
   * Retrieves all users without password hashes.
   * @returns {Array}
   */
  findAll() {
    return db.prepare('SELECT user_id, username, role, created_at FROM users').all();
  }
};
