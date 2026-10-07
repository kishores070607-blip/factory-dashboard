document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  window.setupNav('maintenance', user);

  const selectDevice = document.getElementById('select-device');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnDispatch = document.getElementById('btn-dispatch-cmd');
  const cmdType = document.getElementById('cmd-type');
  const cmdMsg = document.getElementById('cmd-msg');

  // Load devices list
  try {
    const devices = await window.API.getDevices();
    selectDevice.innerHTML = '';
    devices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.device_id || d.id;
      opt.textContent = `${d.device_id || d.id} (${d.line_id || 'unassigned'})`;
      selectDevice.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load devices', err);
  }

  async function loadDeviceData() {
    const deviceId = selectDevice.value;
    if (!deviceId) return;

    try {
      const device = await window.API.getDevice(deviceId);
      const h = device.latestHealth || {};

      const camStatusEl = document.getElementById('val-cam-status');
      const camStatus = h.camera_status || 'connected';
      camStatusEl.textContent = camStatus;
      camStatusEl.className = `badge ${camStatus === 'disconnected' ? 'danger' : (camStatus === 'unstable' ? 'warning' : 'success')}`;

      const camDot = document.getElementById('camera-status-dot');
      camDot.className = `status-dot ${h.camera_status === 'disconnected' ? 'status-critical' : 'status-ok'}`;

      document.getElementById('val-fps').textContent = `${h.fps || 0} FPS`;
      document.getElementById('val-latency').textContent = `${h.inference_latency_ms || 0} ms`;
      document.getElementById('val-model-version').textContent = h.model_version || device.model_version || 'parts-yolo-1.3.0';
      document.getElementById('val-app-version').textContent = h.app_version || device.app_version || '1.0.0';

      const temp = h.temperature_c || 0;
      document.getElementById('val-temp').textContent = `${temp} \u00B0C`;
      const tempBadge = document.getElementById('temp-badge');
      if (temp > 80) {
        tempBadge.className = 'badge danger';
        tempBadge.textContent = 'High Temp';
      } else if (temp > 70) {
        tempBadge.className = 'badge warning';
        tempBadge.textContent = 'Warm';
      } else {
        tempBadge.className = 'badge success';
        tempBadge.textContent = 'Normal';
      }

      document.getElementById('val-cpu').textContent = `${h.cpu_percent || 0}%`;
      document.getElementById('val-mem').textContent = `${h.memory_percent || 0}%`;
      document.getElementById('val-queue').textContent = h.queue_depth || 0;
      document.getElementById('val-last-event').textContent = h.last_event_time ? new Date(h.last_event_time).toLocaleTimeString() : 'None';

      // Load telemetry table
      const samples = await window.API.getDeviceHealth(deviceId);
      const tbodyTelemetry = document.querySelector('#table-telemetry tbody');
      if (!samples || samples.length === 0) {
        tbodyTelemetry.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No telemetry logged</td></tr>';
      } else {
        tbodyTelemetry.innerHTML = samples.map(s => `
          <tr>
            <td>${new Date(s.timestamp).toLocaleTimeString()}</td>
            <td>${s.fps || 0}</td>
            <td>${s.inference_latency_ms || 0} ms</td>
            <td>${s.temperature_c || 0} &deg;C</td>
            <td>${s.queue_depth || 0}</td>
          </tr>
        `).join('');
      }

      // Load command history
      const history = await window.API.getCommandHistory();
      const tbodyCommands = document.querySelector('#table-commands tbody');
      if (!history || history.length === 0) {
        tbodyCommands.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No command history</td></tr>';
      } else {
        tbodyCommands.innerHTML = history.map(c => `
          <tr>
            <td>#${c.command_id}</td>
            <td>${c.device_id}</td>
            <td><code>${c.command_type}</code></td>
            <td><span class="badge ${c.status === 'acknowledged' ? 'success' : 'warning'}">${c.status}</span></td>
            <td>${c.acknowledged_at ? new Date(c.acknowledged_at).toLocaleTimeString() : '-'}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load device details', err);
    }
  }

  btnDispatch.addEventListener('click', async () => {
    const deviceId = selectDevice.value;
    const type = cmdType.value;
    if (!deviceId || !type) return;

    btnDispatch.disabled = true;
    cmdMsg.textContent = 'Enqueuing command...';
    try {
      await window.API.dispatchCommand(deviceId, type);
      cmdMsg.textContent = `Command '${type}' queued successfully for ${deviceId}.`;
      cmdMsg.style.color = '#34d399';
      setTimeout(loadDeviceData, 500);
    } catch (err) {
      cmdMsg.textContent = `Failed: ${err.message}`;
      cmdMsg.style.color = '#f87171';
    } finally {
      btnDispatch.disabled = false;
    }
  });

  selectDevice.addEventListener('change', loadDeviceData);
  btnRefresh.addEventListener('click', loadDeviceData);

  // Auto load initial device
  setTimeout(loadDeviceData, 300);
  setInterval(loadDeviceData, 15000);
});
