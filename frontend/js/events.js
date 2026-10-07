document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  window.setupNav('events', user);

  window.WS.connect();

  let currentPage = 1;
  const tbody = document.querySelector('#events-table tbody');
  const modalVoid = document.getElementById('modal-void');
  const voidEventIdInput = document.getElementById('void-event-id');
  const voidReasonInput = document.getElementById('void-reason');
  const btnCancelVoid = document.getElementById('btn-cancel-void');
  const btnConfirmVoid = document.getElementById('btn-confirm-void');

  const canVoid = user.role === 'supervisor' || user.role === 'administrator';

  async function initFilters() {
    try {
      const [lines, devices, partClasses] = await Promise.all([
        window.API.getLines(),
        window.API.getDevices(),
        window.API.getPartClasses()
      ]);
      const lineSelect = document.getElementById('filter-line');
      lines.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.line_id || l.id;
        opt.textContent = l.name;
        lineSelect.appendChild(opt);
      });
      const deviceSelect = document.getElementById('filter-device');
      devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.device_id || d.id;
        opt.textContent = d.name || d.device_id || d.id;
        deviceSelect.appendChild(opt);
      });

      // Populate autocomplete datalist for part classes
      const datalist = document.getElementById('parts-datalist');
      if (datalist && Array.isArray(partClasses)) {
        datalist.innerHTML = '';
        partClasses.forEach(cls => {
          const opt = document.createElement('option');
          opt.value = cls;
          datalist.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('Failed to load filters', e);
    }
  }

  // Handle Quick Time Presets
  const timePresetSelect = document.getElementById('filter-time-preset');
  const dateFromInput = document.getElementById('filter-from');
  const dateToInput = document.getElementById('filter-to');

  if (timePresetSelect) {
    timePresetSelect.addEventListener('change', () => {
      const val = timePresetSelect.value;
      if (val === 'all') {
        dateFromInput.value = '';
        dateToInput.value = '';
      } else if (val === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        dateFromInput.value = todayStr;
        dateToInput.value = todayStr;
      } else if (val === '15m' || val === '1h') {
        dateFromInput.value = '';
        dateToInput.value = '';
      }
      currentPage = 1;
      loadEvents();
    });
  }

  function getFilters() {
    let from = dateFromInput ? dateFromInput.value : '';
    let to = dateToInput ? dateToInput.value : '';

    const preset = timePresetSelect ? timePresetSelect.value : 'all';
    if (preset === '15m') {
      from = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      to = '';
    } else if (preset === '1h') {
      from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      to = '';
    } else if (preset === 'today' && !from) {
      from = new Date().toISOString().split('T')[0];
    }

    return {
      line: document.getElementById('filter-line').value,
      device: document.getElementById('filter-device').value,
      status: document.getElementById('filter-status').value,
      class: (document.getElementById('filter-class').value || '').trim(),
      from,
      to,
      page: currentPage,
      pageSize: 25
    };
  }

  function renderRow(ev) {
    let statusClass = 'success';
    if (ev.status === 'suspected') statusClass = 'warning';
    if (ev.status === 'manually_voided' || ev.status === 'voided') statusClass = 'danger';

    const isVoided = ev.status === 'manually_voided';
    const actionHtml = canVoid && !isVoided
      ? `<button class="btn btn-danger btn-sm btn-void" data-id="${ev.event_id || ev.id}">Void</button>`
      : (isVoided ? '<span class="text-muted" style="font-size: 0.75rem;">Voided</span>' : '-');

    return `
      <tr id="event-row-${ev.event_id || ev.id}">
        <td title="${ev.event_id || ev.id}">${(ev.event_id || ev.id || '').substring(0, 8)}...</td>
        <td>${ev.device_id || '-'}</td>
        <td>${ev.line_id || '-'}</td>
        <td>${new Date(ev.event_time || ev.timestamp).toLocaleTimeString()}</td>
        <td>${ev.part_class || '-'}</td>
        <td>${ev.quantity || ev.qty || 1}</td>
        <td>${ev.confidence ? (ev.confidence * 100).toFixed(1) + '%' : '-'}</td>
        <td><span class="badge ${statusClass}">${ev.status}</span></td>
        <td>${actionHtml}</td>
      </tr>
    `;
  }

  async function loadEvents() {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading...</td></tr>';
    try {
      const res = await window.API.getEvents(getFilters());
      const events = res.data || [];
      if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No events found</td></tr>';
      } else {
        tbody.innerHTML = events.map(renderRow).join('');

        // Wire void buttons
        document.querySelectorAll('.btn-void').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const eventId = e.target.getAttribute('data-id');
            voidEventIdInput.value = eventId;
            voidReasonInput.value = '';
            modalVoid.classList.remove('hidden');
          });
        });
      }
      
      document.getElementById('total-results').textContent = res.total || 0;
      document.getElementById('page-num').textContent = currentPage;
      
      document.getElementById('btn-prev').disabled = currentPage <= 1;
      document.getElementById('btn-next').disabled = currentPage >= (res.pages || 1);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: var(--color-danger)">Error: ${err.message}</td></tr>`;
    }
  }

  btnCancelVoid.addEventListener('click', () => {
    modalVoid.classList.add('hidden');
  });

  btnConfirmVoid.addEventListener('click', async () => {
    const eventId = voidEventIdInput.value;
    const reason = voidReasonInput.value.trim();
    if (!reason) {
      alert('A reason is mandatory for audited event voiding.');
      return;
    }

    try {
      await window.API.voidEvent(eventId, reason);
      modalVoid.classList.add('hidden');
      loadEvents();
    } catch (err) {
      alert(`Failed to void event: ${err.message}`);
    }
  });

  document.getElementById('btn-search').addEventListener('click', () => {
    currentPage = 1;
    loadEvents();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    document.querySelectorAll('.filter-bar select, .filter-bar input').forEach(el => el.value = '');
    currentPage = 1;
    loadEvents();
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const filters = getFilters();
    delete filters.page;
    delete filters.pageSize;
    window.API.exportCsv(filters);
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadEvents(); }
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    currentPage++; loadEvents();
  });

  const inputClass = document.getElementById('filter-class');
  if (inputClass) {
    inputClass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        currentPage = 1;
        loadEvents();
      }
    });
    inputClass.addEventListener('change', () => {
      currentPage = 1;
      loadEvents();
    });
  }

  window.WS.onMessage('new_event', (payload) => {
    if (currentPage === 1) {
      const filters = getFilters();
      let match = true;
      if (filters.line && filters.line !== payload.line_id) match = false;
      if (filters.device && filters.device !== payload.device_id) match = false;
      if (filters.status && filters.status !== payload.status) match = false;
      if (filters.class) {
        const pClass = (payload.part_class || '').toLowerCase();
        if (!pClass.includes(filters.class.toLowerCase())) {
          match = false;
        }
      }
      
      if (match) {
        const tr = document.createElement('template');
        tr.innerHTML = renderRow(payload).trim();
        tbody.insertBefore(tr.content.firstChild, tbody.firstChild);
        if (tbody.children.length > 25) tbody.lastChild.remove();
      }
    }
  });

  window.WS.onMessage('event_voided', (payload) => {
    const row = document.getElementById(`event-row-${payload.event_id}`);
    if (row) {
      loadEvents();
    }
  });
});
