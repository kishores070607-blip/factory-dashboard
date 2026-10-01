document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  window.setupNav('admin', user);

  if (user.role !== 'administrator') {
    document.getElementById('access-denied').classList.remove('hidden');
    return;
  }
  
  document.getElementById('admin-content').style.display = 'block';

  const devicesTbody = document.querySelector('#devices-table tbody');
  const usersTbody = document.querySelector('#users-table tbody');

  async function loadDevices() {
    devicesTbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    try {
      const devices = await window.API.getDevices();
      if (!devices || devices.length === 0) {
        devicesTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No devices registered</td></tr>';
      } else {
        devicesTbody.innerHTML = devices.map(d => {
          const statusClass = d.status === 'online' ? 'status-online' : 'status-offline';
          return `
            <tr>
              <td>${d.id || '-'}</td>
              <td>${d.name || '-'}</td>
              <td>${d.line_id || '-'}</td>
              <td><span class="status-dot ${statusClass}" title="${d.status}"></span> ${d.status || 'unknown'}</td>
              <td>${d.last_seen ? new Date(d.last_seen).toLocaleString() : '-'}</td>
              <td>${d.app_version || '-'}</td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      devicesTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--color-danger)">Error: ${err.message}</td></tr>`;
    }
  }

  async function loadUsers() {
    usersTbody.innerHTML = '<tr><td colspan="2" class="text-center">Loading...</td></tr>';
    try {
      const users = await window.API.getUsers();
      if (!users || users.length === 0) {
        usersTbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No users</td></tr>';
      } else {
        usersTbody.innerHTML = users.map(u => `
          <tr>
            <td>${u.username}</td>
            <td><span class="badge ${u.role === 'administrator' ? 'danger' : 'success'}">${u.role}</span></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      usersTbody.innerHTML = `<tr><td colspan="2" class="text-center" style="color: var(--color-danger)">Error: ${err.message}</td></tr>`;
    }
  }

  document.getElementById('btn-refresh-devices').addEventListener('click', loadDevices);

  document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('add-user-msg');
    msg.className = 'hidden';
    
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const btn = e.target.querySelector('button');
    btn.disabled = true;

    try {
      await window.API.request('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role })
      });
      msg.textContent = 'User created successfully!';
      msg.className = 'alert-error';
      msg.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      msg.style.color = '#34d399';
      msg.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      e.target.reset();
      loadUsers();
    } catch (err) {
      msg.textContent = err.message || 'Failed to create user';
      msg.className = 'alert-error';
      msg.style.backgroundColor = '';
      msg.style.color = '';
      msg.style.borderColor = '';
    } finally {
      btn.disabled = false;
    }
  });

  loadDevices();
  loadUsers();
  setInterval(loadDevices, 30000);
});
