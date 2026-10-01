document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  window.setupNav('config', user);

  const selectDevice = document.getElementById('select-config-device');
  const activeJson = document.getElementById('active-config-json');
  const activeVersionTag = document.getElementById('active-version-tag');
  const tbody = document.querySelector('#table-config-versions tbody');

  const modalDraft = document.getElementById('modal-draft');
  const btnNewDraft = document.getElementById('btn-new-draft');
  const btnCancelDraft = document.getElementById('btn-cancel-draft');
  const formCreateDraft = document.getElementById('form-create-draft');

  // Load devices
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

  async function loadConfigurations() {
    const deviceId = selectDevice.value;
    if (!deviceId) return;

    // Load active published config
    try {
      const active = await window.API.request(`/api/v1/config/${deviceId}`);
      activeVersionTag.textContent = `Version ${active.version}`;
      activeJson.textContent = JSON.stringify(active, null, 2);
    } catch (e) {
      activeVersionTag.textContent = 'No approved version';
      activeJson.textContent = '// No approved configuration found for this device.';
    }

    // Load versions history
    try {
      const versions = await window.API.getConfigVersions(deviceId);
      if (!versions || versions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No versions found</td></tr>';
      } else {
        tbody.innerHTML = versions.map(v => {
          let statusBadge = 'warning';
          if (v.status === 'approved') statusBadge = 'success';
          if (v.status === 'deprecated') statusBadge = 'danger';

          const canApprove = (user.role === 'administrator' || user.role === 'supervisor') && v.status === 'draft';

          return `
            <tr>
              <td>#${v.config_id}</td>
              <td><strong>${v.version}</strong></td>
              <td><span class="badge ${statusBadge}">${v.status}</span></td>
              <td>${v.created_by}</td>
              <td>${new Date(v.created_at).toLocaleString()}</td>
              <td>${v.approved_by || '-'}</td>
              <td>${v.approved_at ? new Date(v.approved_at).toLocaleString() : '-'}</td>
              <td>
                ${canApprove ? `<button class="btn btn-primary btn-sm btn-approve" data-id="${v.config_id}">Approve</button>` : '-'}
              </td>
            </tr>
          `;
        }).join('');

        // Wire approve buttons
        document.querySelectorAll('.btn-approve').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (confirm(`Approve configuration #${id} and deploy as active version?`)) {
              try {
                await window.API.approveConfig(id);
                loadConfigurations();
              } catch (err) {
                alert(`Approval failed: ${err.message}`);
              }
            }
          });
        });
      }
    } catch (err) {
      console.error('Failed to load version history', err);
    }
  }

  btnNewDraft.addEventListener('click', () => {
    modalDraft.classList.remove('hidden');
  });

  btnCancelDraft.addEventListener('click', () => {
    modalDraft.classList.add('hidden');
  });

  formCreateDraft.addEventListener('submit', async (e) => {
    e.preventDefault();
    const deviceId = selectDevice.value;
    const version = document.getElementById('draft-version').value;
    const direction = document.getElementById('draft-direction').value;
    const confidence = parseFloat(document.getElementById('draft-confidence').value);
    const model = document.getElementById('draft-model').value;
    
    let roi = {};
    try {
      roi = JSON.parse(document.getElementById('draft-roi').value);
    } catch (err) {
      alert('Invalid ROI JSON syntax');
      return;
    }

    const payload = {
      roi,
      crossing_line: { y: 240, direction },
      confidence_threshold: confidence,
      model_version: model
    };

    try {
      await window.API.createConfigDraft({
        device_id: deviceId,
        version,
        payload
      });
      modalDraft.classList.add('hidden');
      formCreateDraft.reset();
      loadConfigurations();
    } catch (err) {
      alert(`Failed to save draft: ${err.message}`);
    }
  });

  selectDevice.addEventListener('change', loadConfigurations);

  // Initial load
  setTimeout(loadConfigurations, 300);
});
