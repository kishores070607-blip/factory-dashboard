document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  window.setupNav('overview', user);

  window.WS.connect();

  const grid = document.getElementById('lines-grid');
  const lastUpdated = document.getElementById('last-updated');

  async function loadLines() {
    try {
      const lines = await window.API.getLines();
      if (!lines || lines.length === 0) {
        grid.innerHTML = '<p class="text-muted">No lines found.</p>';
        return;
      }
      grid.innerHTML = '';
      lines.forEach(line => {
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `line-card-${line.line_id || line.id}`;
        
        let statusClass = 'status-online';
        if (line.status === 'warning') statusClass = 'status-warning';
        if (line.status === 'critical') statusClass = 'status-critical';
        
        card.innerHTML = `
          <div class="card-header">
            <h3 class="card-title">${line.name || 'Line'} <span style="font-size: 0.875rem; color: var(--text-muted)">(${line.location || 'Unknown'})</span></h3>
            <span class="status-dot ${statusClass}" title="${line.status}"></span>
          </div>
          <div class="metric-grid metric-grid-2">
            <div class="metric-tile">
              <span class="metric-label">Total Today</span>
              <div class="metric-val" id="line-count-${line.line_id || line.id}">${line.total_count_today || line.countToday || 0}</div>
            </div>
            <div class="metric-tile">
              <span class="metric-label">Rate (Last 60s)</span>
              <div class="metric-val" id="line-rate-${line.line_id || line.id}">${line.rate_per_min || line.ratePerMinute || 0} <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted);">/min</span></div>
            </div>
          </div>
          <div class="mt-4 pt-4" style="border-top: 1px solid var(--border-color);">
            <div class="text-muted mb-2" style="font-size: 0.875rem;">Assigned Devices (${line.devices ? line.devices.length : 0})</div>
            <div class="d-flex" style="gap: 0.5rem; flex-wrap: wrap;">
              ${(line.devices || []).map(d => `<span id="device-dot-${d.device_id || d.id}" class="status-dot ${d.status === 'online' ? 'status-online' : (d.status === 'stale' ? 'status-warning' : 'status-offline')}" title="${d.display_name || d.device_id || d.name} (${d.status})"></span>`).join('')}
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
      lastUpdated.textContent = new Date().toLocaleTimeString();
    } catch (err) {
      grid.innerHTML = `<div class="alert-error">Failed to load lines: ${err.message}</div>`;
    }
  }

  loadLines();
  setInterval(loadLines, 20000);

  // WS Handlers
  window.WS.onMessage('new_event', (payload) => {
    const lineId = payload.line_id;
    const countEl = document.getElementById(`line-count-${lineId}`);
    if (countEl) {
      countEl.textContent = parseInt(countEl.textContent || 0) + (payload.qty || payload.quantity || 1);
      const card = document.getElementById(`line-card-${lineId}`);
      if (card) {
        card.style.borderColor = 'var(--color-primary)';
        setTimeout(() => card.style.borderColor = 'var(--border-color)', 500);
      }
    }
  });

  window.WS.onMessage('device_status', (payload) => {
    const dot = document.getElementById(`device-dot-${payload.device_id}`);
    if (dot) {
      dot.className = `status-dot ${payload.status === 'online' ? 'status-online' : (payload.status === 'stale' ? 'status-warning' : 'status-offline')}`;
    }
  });

  window.WS.onMessage('alert_raised', (payload) => {
    window.WS.showToast(`Alert: ${payload.rule} on ${payload.device}`, payload.severity || 'warning');
  });
});
