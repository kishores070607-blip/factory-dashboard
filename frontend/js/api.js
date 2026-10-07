/**
 * Shared API helper module.
 */

window.API = {
  /**
   * Helper to execute fetch and handle JSON/errors.
   */
  async request(endpoint, options = {}) {
    options.headers = options.headers || {};
    if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    options.credentials = 'same-origin'; // Send cookies if any
    const response = await fetch(endpoint, options);
    if (!response.ok) {
      let msg = response.statusText;
      try {
        const err = await response.json();
        msg = err.message || err.error || msg;
      } catch (e) {
        // ignore
      }
      throw new Error(msg);
    }
    // Return null on 204 No Content
    if (response.status === 204) return null;
    return response.json();
  },

  /**
   * Build query string from object.
   */
  buildQuery(filters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    }
    const query = params.toString();
    return query ? '?' + query : '';
  },

  async login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  },

  async me() {
    try {
      return await this.request('/api/auth/me');
    } catch (err) {
      return null;
    }
  },

  async getLines() {
    return this.request('/api/lines');
  },

  async getLineOverview(lineId) {
    return this.request(`/api/lines/${lineId}/overview`);
  },

  async getEvents(filters) {
    return this.request('/api/events' + this.buildQuery(filters));
  },

  async getPartClasses() {
    try {
      return await this.request('/api/events/classes');
    } catch (e) {
      return ['bearing-D', 'gasket-C', 'widget-A', 'widget-B'];
    }
  },

  async voidEvent(eventId, reason) {
    return this.request('/api/corrections/void', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, reason })
    });
  },

  async getCorrections(eventId = null) {
    return this.request('/api/corrections' + this.buildQuery({ event_id: eventId }));
  },

  async getAlerts(state) {
    return this.request('/api/alerts' + this.buildQuery({ state }));
  },

  async ackAlert(alertId) {
    return this.request(`/api/alerts/${alertId}/ack`, { method: 'POST' });
  },

  async getDevices() {
    return this.request('/api/v1/devices');
  },

  async getDevice(id) {
    return this.request(`/api/v1/devices/${id}`);
  },

  async getDeviceHealth(id) {
    return this.request(`/api/v1/devices/${id}/health`);
  },

  async dispatchCommand(deviceId, commandType, payload = null) {
    return this.request(`/api/devices/${deviceId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ command_type: commandType, payload })
    });
  },

  async getCommandHistory() {
    return this.request('/api/devices/history/all');
  },

  async getConfigVersions(deviceId = null) {
    return this.request('/api/config/versions/list' + this.buildQuery({ device_id: deviceId }));
  },

  async createConfigDraft(data) {
    return this.request('/api/config/versions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async approveConfig(configId) {
    return this.request(`/api/config/versions/${configId}/approve`, {
      method: 'POST'
    });
  },

  async getReportMeta() {
    return this.request('/api/reports/meta');
  },

  async getShiftReport(shiftId, date = null, lineId = null) {
    return this.request('/api/reports/shift' + this.buildQuery({ shift_id: shiftId, date, line_id: lineId }));
  },

  async getBatchReport(batchId) {
    return this.request('/api/reports/batch' + this.buildQuery({ batch_id: batchId }));
  },

  async getUsers() {
    return this.request('/api/auth/users');
  },

  exportCsv(filters) {
    const url = '/api/export/events.csv' + this.buildQuery(filters);
    window.open(url, '_blank');
  }
};
