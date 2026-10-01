const { db } = require('../db');

module.exports = {
  /**
   * Finds an event by its ID.
   * @param {string} eventId - The event ID.
   * @returns {object|undefined} The event row or undefined.
   */
  findById(eventId) {
    return db.prepare('SELECT * FROM count_events WHERE event_id = ?').get(eventId);
  },

  /**
   * Inserts a new count event with all schema fields.
   * @param {object} event - The event data.
   * @returns {object} The inserted row.
   */
  insert(event) {
    db.prepare(`
      INSERT INTO count_events (
        event_id, schema_version, device_id, line_id, event_sequence,
        event_time, received_time, part_class, quantity, confidence,
        track_id, direction, batch_id, shift_id, image_reference,
        model_version, processing_latency_ms, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.event_id,
      event.schema_version || '1.0',
      event.device_id,
      event.line_id || null,
      event.event_sequence || null,
      event.event_time,
      event.received_time || new Date().toISOString(),
      event.part_class || null,
      event.quantity || 1,
      event.confidence || null,
      event.track_id || null,
      event.direction || null,
      event.batch_id || null,
      event.shift_id || null,
      event.image_reference || null,
      event.model_version || null,
      event.processing_latency_ms || null,
      event.status || 'accepted'
    );
    return this.findById(event.event_id);
  },

  /**
   * Finds events based on filters with pagination.
   * @param {object} filters - { lineId, deviceId, partClass, status, from, to, page, pageSize }
   * @returns {object} { data: rows[], total: number }
   */
  findFiltered(filters = {}) {
    let query = 'FROM count_events WHERE 1=1';
    const params = [];

    if (filters.lineId) {
      query += ' AND line_id = ?';
      params.push(filters.lineId);
    }
    if (filters.deviceId) {
      query += ' AND device_id = ?';
      params.push(filters.deviceId);
    }
    if (filters.partClass) {
      query += ' AND part_class = ?';
      params.push(filters.partClass);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.from) {
      query += ' AND event_time >= ?';
      params.push(filters.from);
    }
    if (filters.to) {
      query += ' AND event_time <= ?';
      params.push(filters.to);
    }

    const countRow = db.prepare(`SELECT count(*) as total ${query}`).get(...params);
    const total = countRow.total;

    const page = parseInt(filters.page) || 1;
    const pageSize = parseInt(filters.pageSize) || 50;
    const offset = (page - 1) * pageSize;

    query += ' ORDER BY event_time DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const data = db.prepare(`SELECT * ${query}`).all(...params);

    return { data, total };
  },

  /**
   * Counts total quantity for a line since a timestamp.
   * @param {string} lineId - The line ID.
   * @param {string} since - ISO timestamp.
   * @returns {number} The total quantity.
   */
  countByLine(lineId, since) {
    const row = db.prepare(`
      SELECT COALESCE(sum(quantity), 0) as total 
      FROM count_events 
      WHERE line_id = ? AND event_time >= ?
    `).get(lineId, since);
    return row.total || 0;
  },

  /**
   * Returns recent events for a line within the last N seconds.
   * @param {string} lineId - The line ID.
   * @param {number} seconds - Number of seconds to look back.
   * @returns {Array} List of events.
   */
  recentByLine(lineId, seconds) {
    const since = new Date(Date.now() - seconds * 1000).toISOString();
    return db.prepare(`
      SELECT * FROM count_events 
      WHERE line_id = ? AND event_time >= ?
      ORDER BY event_time DESC
    `).all(lineId, since);
  }
};
