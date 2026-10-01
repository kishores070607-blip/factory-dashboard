const { db } = require('../persistence/db');
const shiftBatchRepository = require('../persistence/repositories/shiftBatchRepository');

/**
 * Generates an analytical report for a specific shift.
 * @param {string} shiftId 
 * @param {string} date YYYY-MM-DD or default today
 * @param {string} lineId optional line filter
 */
function getShiftReport(shiftId, date = null, lineId = null) {
  const shift = shiftBatchRepository.findShiftById(shiftId) || {
    shift_id: shiftId,
    name: shiftId,
    start_time: '06:00',
    end_time: '14:00'
  };

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

  // Count accepted, suspected, manually_voided
  const totalAcceptedRow = db.prepare(`SELECT COALESCE(sum(quantity), 0) as total ${eventQuery} AND status = 'accepted'`).get(...params);
  const totalVoidedRow = db.prepare(`SELECT count(*) as total ${eventQuery} AND status = 'manually_voided'`).get(...params);
  const totalSuspectedRow = db.prepare(`SELECT count(*) as total ${eventQuery} AND status = 'suspected'`).get(...params);
  const totalEventsRow = db.prepare(`SELECT count(*) as total ${eventQuery}`).get(...params);

  // Target comparison
  const target = (lineId ? shiftBatchRepository.findTargetForLineAndShift(lineId, shiftId) : null) || {
    target_quantity: 1000,
    target_rate_per_hour: 125.0
  };

  const actualCount = totalAcceptedRow ? totalAcceptedRow.total : 0;
  const targetCount = target.target_quantity || 1000;
  const completionPct = targetCount > 0 ? Number(((actualCount / targetCount) * 100).toFixed(1)) : 0;

  // Hourly throughput breakdown
  const hourlyRows = db.prepare(`
    SELECT strftime('%H', event_time) as hour, sum(quantity) as count
    ${eventQuery} AND status = 'accepted'
    GROUP BY strftime('%H', event_time)
    ORDER BY hour ASC
  `).all(...params);

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
      targetRatePerHour: target.target_rate_per_hour || 125.0,
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
