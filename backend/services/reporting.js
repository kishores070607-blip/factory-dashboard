const { db } = require('../persistence/db');
const shiftBatchRepository = require('../persistence/repositories/shiftBatchRepository');

/**
 * Generates an analytical report for a specific shift.
 * @param {string} shiftId 
 * @param {string} date YYYY-MM-DD or default today
 * @param {string} lineId optional line filter
 */
function getShiftReport(shiftId, date = null, lineId = null) {
  const shift = shiftId ? (shiftBatchRepository.findShiftById(shiftId) || {
    shift_id: shiftId,
    name: shiftId,
    start_time: '06:00',
    end_time: '14:00'
  }) : null;

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Base query for events during shift window
  let eventQuery = `
    FROM count_events 
    WHERE strftime('%Y-%m-%d', event_time) = ?
  `;
  const params = [targetDate];

  if (lineId) {
    eventQuery += ' AND line_id = ?';
    params.push(lineId);
  }

  // Filter strictly by shift hours so that metrics and hourly chart always align
  if (shift && shift.start_time && shift.end_time) {
    const startH = parseInt(shift.start_time.split(':')[0], 10);
    const endH = parseInt(shift.end_time.split(':')[0], 10);
    if (startH < endH) {
      eventQuery += " AND time(event_time) >= time(?) AND time(event_time) < time(?)";
      params.push(shift.start_time, shift.end_time);
    } else {
      // Overnight shift spanning midnight (e.g. 22:00 to 06:00)
      eventQuery += " AND (time(event_time) >= time(?) OR time(event_time) < time(?))";
      params.push(shift.start_time, shift.end_time);
    }
  } else if (shift && shift.shift_id) {
    eventQuery += ' AND shift_id = ?';
    params.push(shift.shift_id);
  }

  // Count accepted, suspected, manually_voided
  const totalAcceptedRow = db.prepare(`SELECT COALESCE(sum(quantity), 0) as total ${eventQuery} AND status = 'accepted'`).get(...params);
  const totalVoidedRow = db.prepare(`SELECT count(*) as total ${eventQuery} AND status = 'manually_voided'`).get(...params);
  const totalSuspectedRow = db.prepare(`SELECT count(*) as total ${eventQuery} AND status = 'suspected'`).get(...params);
  const totalEventsRow = db.prepare(`SELECT count(*) as total ${eventQuery}`).get(...params);

  // Target comparison
  const target = (lineId && shift ? shiftBatchRepository.findTargetForLineAndShift(lineId, shift.shift_id) : null) || {
    target_quantity: 1000,
    target_rate_per_hour: 125.0
  };

  const actualCount = totalAcceptedRow ? totalAcceptedRow.total : 0;
  const targetCount = target.target_quantity || 1000;
  const targetRate = target.target_rate_per_hour || 125.0;
  const completionPct = targetCount > 0 ? Number(((actualCount / targetCount) * 100).toFixed(1)) : 0;

  // Hourly throughput breakdown
  const rawHourlyRows = db.prepare(`
    SELECT strftime('%H', event_time) as hour, sum(quantity) as count
    ${eventQuery} AND status = 'accepted'
    GROUP BY strftime('%H', event_time)
    ORDER BY hour ASC
  `).all(...params);

  const hourlyMap = new Map();
  rawHourlyRows.forEach(r => hourlyMap.set(r.hour, r.count));

  // Determine full hour sequence for the shift
  let hoursToDisplay = [];
  if (shift && shift.start_time && shift.end_time) {
    const startH = parseInt(shift.start_time.split(':')[0], 10);
    const endH = parseInt(shift.end_time.split(':')[0], 10);
    if (startH < endH) {
      for (let h = startH; h < endH; h++) {
        hoursToDisplay.push(String(h).padStart(2, '0'));
      }
    } else {
      for (let h = startH; h < 24; h++) hoursToDisplay.push(String(h).padStart(2, '0'));
      for (let h = 0; h < endH; h++) hoursToDisplay.push(String(h).padStart(2, '0'));
    }
  } else if (rawHourlyRows.length > 0) {
    hoursToDisplay = rawHourlyRows.map(r => r.hour);
  } else {
    hoursToDisplay = ['06', '07', '08', '09', '10', '11', '12', '13'];
  }

  const hourlyRows = hoursToDisplay.map(hour => ({
    hour,
    count: hourlyMap.get(hour) || 0
  }));

  // Calculate actual pace (rate per hour) & completion forecast (ETA)
  const isToday = targetDate === new Date().toISOString().split('T')[0];
  const nowUtcHour = new Date().getUTCHours();
  const nowUtcMin = new Date().getUTCMinutes();

  let elapsedHours = 8;
  let isCurrentShift = false;

  if (shift && shift.start_time && shift.end_time) {
    const startH = parseInt(shift.start_time.split(':')[0], 10);
    const endH = parseInt(shift.end_time.split(':')[0], 10);
    const durationHours = endH > startH ? (endH - startH) : (24 - startH + endH);

    if (isToday) {
      if (startH < endH) {
        if (nowUtcHour >= startH && nowUtcHour < endH) {
          isCurrentShift = true;
          const mins = (nowUtcHour - startH) * 60 + nowUtcMin;
          elapsedHours = Math.max(0.5, Number((mins / 60).toFixed(2)));
        } else if (nowUtcHour < startH) {
          elapsedHours = 0;
        } else {
          elapsedHours = durationHours;
        }
      } else {
        if (nowUtcHour >= startH || nowUtcHour < endH) {
          isCurrentShift = true;
          const mins = nowUtcHour >= startH ? (nowUtcHour - startH) * 60 + nowUtcMin : (24 - startH + nowUtcHour) * 60 + nowUtcMin;
          elapsedHours = Math.max(0.5, Number((mins / 60).toFixed(2)));
        } else {
          elapsedHours = durationHours;
        }
      }
    } else {
      elapsedHours = durationHours;
    }
  }

  const activeHoursWithData = hourlyRows.filter(h => h.count > 0).length;
  const effectiveHours = isCurrentShift ? elapsedHours : Math.max(1, activeHoursWithData || elapsedHours);
  const actualRatePerHour = effectiveHours > 0 ? Math.round(actualCount / effectiveHours) : 0;
  const rateDifference = actualRatePerHour - targetRate;
  const paceStatus = rateDifference >= 0 ? 'ahead' : 'behind';

  // Estimated Completion (ETA)
  const remainingUnits = Math.max(0, targetCount - actualCount);
  let etaMinutes = null;
  let etaText = 'Target Achieved';

  if (actualCount >= targetCount) {
    etaText = 'Target Achieved (100% Complete)';
    etaMinutes = 0;
  } else if (actualRatePerHour > 0) {
    etaMinutes = Math.round((remainingUnits / actualRatePerHour) * 60);
    const h = Math.floor(etaMinutes / 60);
    const m = etaMinutes % 60;
    const durationStr = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
    
    const projDate = new Date(Date.now() + etaMinutes * 60 * 1000);
    const projHours = String(projDate.getUTCHours()).padStart(2, '0');
    const projMins = String(projDate.getUTCMinutes()).padStart(2, '0');
    etaText = `${durationStr} (est. ${projHours}:${projMins} UTC)`;
  } else {
    etaText = actualCount > 0 ? 'Pace Stalled (0 / hr)' : 'Awaiting Production Run';
  }

  // Confidence distribution
  const confHigh = db.prepare(`SELECT count(*) as count ${eventQuery} AND confidence >= 0.95`).get(...params).count;
  const confMed = db.prepare(`SELECT count(*) as count ${eventQuery} AND confidence >= 0.90 AND confidence < 0.95`).get(...params).count;
  const confLow = db.prepare(`SELECT count(*) as count ${eventQuery} AND confidence < 0.90`).get(...params).count;

  // Downtime / Stale periods count from alerts
  const alertCount = db.prepare(`
    SELECT count(*) as count 
    FROM alerts 
    WHERE strftime('%Y-%m-%d', raised_at) = ?
  `).get(targetDate).count;

  return {
    shift,
    date: targetDate,
    lineId,
    metrics: {
      actualCount,
      targetCount,
      completionPct,
      voidedCount: totalVoidedRow.total,
      suspectedCount: totalSuspectedRow.total,
      totalEvents: totalEventsRow.total,
      targetRatePerHour: targetRate,
      actualRatePerHour,
      rateDifference,
      paceStatus,
      isCurrentShift,
      remainingUnits,
      etaMinutes,
      etaText,
      alertCount
    },
    hourlyDistribution: hourlyRows,
    confidenceDistribution: {
      high: confHigh,      // >= 0.95
      medium: confMed,    // 0.90 - 0.95
      low: confLow        // < 0.90
    }
  };
}

/**
 * Generates an analytical report for a specific production batch.
 * @param {string} batchId 
 */
function getBatchReport(batchId) {
  const batch = shiftBatchRepository.findBatchById(batchId) || {
    batch_id: batchId,
    product: 'Unknown',
    planned_quantity: 1000,
    status: 'active'
  };

  const actualAccepted = db.prepare(`
    SELECT COALESCE(sum(quantity), 0) as total, count(*) as events
    FROM count_events 
    WHERE batch_id = ? AND status = 'accepted'
  `).get(batchId);

  const voided = db.prepare(`
    SELECT count(*) as total 
    FROM count_events 
    WHERE batch_id = ? AND status = 'manually_voided'
  `).get(batchId).total;

  const actualCount = actualAccepted ? actualAccepted.total : 0;
  const plannedCount = batch.planned_quantity || 1000;
  const completionPct = plannedCount > 0 ? Number(((actualCount / plannedCount) * 100).toFixed(1)) : 0;

  // Breakdown by part class
  const classBreakdown = db.prepare(`
    SELECT part_class, sum(quantity) as total 
    FROM count_events 
    WHERE batch_id = ? AND status = 'accepted'
    GROUP BY part_class
  `).all(batchId);

  return {
    batch,
    metrics: {
      actualCount,
      plannedCount,
      completionPct,
      voidedCount: voided,
      totalAcceptedEvents: actualAccepted.events
    },
    classBreakdown
  };
}

module.exports = {
  getShiftReport,
  getBatchReport
};
