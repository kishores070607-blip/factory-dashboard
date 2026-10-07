document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.API.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  window.setupNav('reports', user);

  const tabShift = document.getElementById('tab-shift');
  const tabBatch = document.getElementById('tab-batch');
  const sectionShift = document.getElementById('section-shift');
  const sectionBatch = document.getElementById('section-batch');

  tabShift.addEventListener('click', () => {
    tabShift.classList.add('active');
    tabBatch.classList.remove('active');
    sectionShift.classList.remove('hidden');
    sectionBatch.classList.add('hidden');
  });

  tabBatch.addEventListener('click', () => {
    tabBatch.classList.add('active');
    tabShift.classList.remove('active');
    sectionBatch.classList.remove('hidden');
    sectionShift.classList.add('hidden');
  });

  // Populate filter selectors
  try {
    const meta = await window.API.getReportMeta();
    const selectShift = document.getElementById('select-shift');
    meta.shifts.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.shift_id;
      opt.textContent = s.name;
      selectShift.appendChild(opt);
    });

    const selectLine = document.getElementById('select-shift-line');
    meta.lines.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.line_id;
      opt.textContent = l.name;
      selectLine.appendChild(opt);
    });

    const selectBatch = document.getElementById('select-batch');
    meta.batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.batch_id;
      opt.textContent = `${b.batch_id} (${b.product})`;
      selectBatch.appendChild(opt);
    });

    // Default today date
    document.getElementById('select-shift-date').value = new Date().toISOString().split('T')[0];
  } catch (err) {
    console.error('Failed to load metadata', err);
  }

  // Load Shift Report
  async function loadShiftReport() {
    const btn = document.getElementById('btn-load-shift');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating...';
    }

    const shiftId = document.getElementById('select-shift').value;
    const lineId = document.getElementById('select-shift-line').value;
    const date = document.getElementById('select-shift-date').value;

    try {
      const report = await window.API.getShiftReport(shiftId, date, lineId);
      const m = report.metrics;

      document.getElementById('val-shift-counts').textContent = `${m.actualCount} / ${m.targetCount}`;
      document.getElementById('val-shift-completion').textContent = `${m.completionPct}%`;
      document.getElementById('progress-shift').style.width = `${Math.min(m.completionPct, 100)}%`;

      document.getElementById('val-shift-voided').textContent = m.voidedCount;
      document.getElementById('val-shift-suspected').textContent = m.suspectedCount;
      document.getElementById('val-shift-alerts').textContent = m.alertCount;
      document.getElementById('val-shift-rate').textContent = `${m.targetRatePerHour} / hr`;

      document.getElementById('conf-high').textContent = report.confidenceDistribution.high;
      document.getElementById('conf-med').textContent = report.confidenceDistribution.medium;
      document.getElementById('conf-low').textContent = report.confidenceDistribution.low;

      // Render CSS bar chart
      const chartEl = document.getElementById('chart-hourly');
      chartEl.innerHTML = '';
      if (!report.hourlyDistribution || report.hourlyDistribution.length === 0) {
        chartEl.innerHTML = '<div class="text-muted text-center" style="width: 100%; padding: 2rem;">No hourly event data recorded for this window.</div>';
      } else {
        const counts = report.hourlyDistribution.map(h => h.count);
        const maxVal = Math.max(...counts, 1);
        report.hourlyDistribution.forEach(h => {
          const col = document.createElement('div');
          col.className = 'bar-column';
          const heightPct = h.count > 0 ? Math.round((h.count / maxVal) * 78) + 4 : 2;
          col.innerHTML = `
            <div class="bar-val">${h.count}</div>
            <div class="bar-fill" style="height: ${heightPct}%;" title="${h.hour}:00 — ${h.count} parts accepted"></div>
            <div class="bar-label">${h.hour}:00</div>
          `;
          chartEl.appendChild(col);
        });
      }
    } catch (err) {
      console.error('Failed to load shift report', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Generate Report';
      }
    }
  }

  // Load Batch Report
  async function loadBatchReport() {
    const batchId = document.getElementById('select-batch').value;
    if (!batchId) return;

    try {
      const report = await window.API.getBatchReport(batchId);
      const m = report.metrics;

      document.getElementById('batch-product-name').textContent = `Product: ${report.batch.product}`;
      document.getElementById('val-batch-counts').textContent = `${m.actualCount} / ${m.plannedCount}`;
      document.getElementById('val-batch-completion').textContent = `${m.completionPct}%`;
      document.getElementById('progress-batch').style.width = `${Math.min(m.completionPct, 100)}%`;
      document.getElementById('val-batch-voided').textContent = m.voidedCount;

      const tbody = document.querySelector('#table-batch-classes tbody');
      tbody.innerHTML = '';
      if (!report.classBreakdown || report.classBreakdown.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No counts recorded for this batch.</td></tr>';
      } else {
        tbody.innerHTML = report.classBreakdown.map(c => `
          <tr>
            <td><strong>${c.part_class}</strong></td>
            <td>${c.total}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load batch report', err);
    }
  }

  document.getElementById('btn-load-shift').addEventListener('click', loadShiftReport);
  document.getElementById('btn-load-batch').addEventListener('click', loadBatchReport);

  // Auto-refresh when selectors change for responsive UX
  document.getElementById('select-shift').addEventListener('change', loadShiftReport);
  document.getElementById('select-shift-line').addEventListener('change', loadShiftReport);
  document.getElementById('select-shift-date').addEventListener('change', loadShiftReport);
  document.getElementById('select-batch').addEventListener('change', loadBatchReport);

  // Initial load
  loadShiftReport();
  loadBatchReport();
});
