document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  window.setupNav('alerts', user);

  window.WS.connect();

  let currentState = 'active';
  const tbody = document.querySelector('#alerts-table tbody');

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentState = e.target.dataset.state;
      loadAlerts();
    });
  });

  function renderRow(alert) {
    let sevBadge = '';
    if (alert.severity === 'critical') sevBadge = '<span class="badge danger">Critical</span>';
    else if (alert.severity === 'warning') sevBadge = '<span class="badge warning">Warning</span>';
    else sevBadge = '<span class="badge success">Info</span>';

    let ackInfo = '-';
    if (alert.acknowledged_by) {
      ackInfo = `${alert.acknowledged_by} <br><small class="text-muted">${new Date(alert.acknowledged_at).toLocaleString()}</small>`;
    }

    let actionBtn = '-';
    if (currentState === 'active') {
      actionBtn = `<button class="btn btn-primary btn-sm ack-btn" data-id="${alert.alert_id || alert.id}">Acknowledge</button>`;
    }

    return `
      <tr>
        <td>${sevBadge}</td>
        <td>${alert.rule || 'Unknown Rule'}</td>
        <td>${alert.source_device_id || alert.device_id || '-'}</td>
        <td>${new Date(alert.raised_at || alert.timestamp).toLocaleString()}</td>
        <td>${ackInfo}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }

  async function loadAlerts() {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    try {
      const alerts = await window.API.getAlerts(currentState);
      if (!alerts || alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No alerts found</td></tr>';
      } else {
        tbody.innerHTML = alerts.map(renderRow).join('');
        
        document.querySelectorAll('.ack-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            try {
              await window.API.ackAlert(id);
              loadAlerts();
            } catch (err) {
              alert('Failed to acknowledge: ' + err.message);
            }
          });
        });
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--color-danger)">Error: ${err.message}</td></tr>`;
    }
  }

  loadAlerts();

  window.WS.onMessage('alert_raised', () => {
    if (currentState === 'active') loadAlerts();
  });
  window.WS.onMessage('alert_ack', () => {
    loadAlerts();
  });
});
