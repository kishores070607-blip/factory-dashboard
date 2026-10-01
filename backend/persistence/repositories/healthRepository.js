const { db } = require('../db');

module.exports = {
  /**
   * Inserts a new health sample with all schema columns.
   * @param {object} sample
   */
  insert(sample) {
    db.prepare(`
      INSERT INTO health_samples (
        device_id, timestamp, service_status, camera_status,
        fps, inference_latency_ms, cpu_percent, memory_percent,
        temperature_c, queue_depth, last_event_time, model_version,
        app_version, error_code, message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sample.device_id,
      sample.timestamp || new Date().toISOString(),
      sample.service_status || null,
      sample.camera_status || null,
      sample.fps || null,
      sample.inference_latency_ms || null,
      sample.cpu_percent || null,
      sample.memory_percent || null,
      sample.temperature_c || null,
      sample.queue_depth || null,
      sample.last_event_time || null,
      sample.model_version || null,
      sample.app_version || null,
      sample.error_code || null,
      sample.message || null
    );
  },

  /**
   * Retrieves the latest health sample for a device.
   * @param {string} deviceId
   * @returns {object|undefined}
   */
  latestByDevice(deviceId) {
    return db.prepare(`
      SELECT * FROM health_samples 
      WHERE device_id = ? 
      ORDER BY timestamp DESC LIMIT 1
    `).get(deviceId);
  },

  /**
   * Retrieves recent health samples for a device.
   * @param {string} deviceId
   * @param {number} limit
   * @returns {Array}
   */
  findByDevice(deviceId, limit = 50) {
    return db.prepare(`
      SELECT * FROM health_samples 
      WHERE device_id = ? 
      ORDER BY timestamp DESC LIMIT ?
    `).all(deviceId, limit);
  }
};
