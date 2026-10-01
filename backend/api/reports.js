const express = require('express');
const reportingService = require('../services/reporting');
const shiftBatchRepository = require('../persistence/repositories/shiftBatchRepository');
const lineRepository = require('../persistence/repositories/lineRepository');
const { requireAuth, requireRole } = require('../security/auth');

const router = express.Router();

/**
 * Returns available shifts, batches, and lines for report filter drop-downs.
 * GET /api/reports/meta
 */
router.get('/meta', requireAuth, (req, res) => {
  try {
    const shifts = shiftBatchRepository.getShifts();
    const batches = shiftBatchRepository.getBatches();
    const lines = lineRepository.findAll();
    return res.json({ shifts, batches, lines });
  } catch (err) {
    console.error('Error fetching report metadata:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Generates shift report with hourly rates and target comparison.
 * GET /api/reports/shift?shift_id=SHIFT-1&date=2026-09-07&line_id=line-1
 */
router.get('/shift', requireAuth, requireRole('supervisor', 'administrator', 'quality_engineer', 'auditor', 'operator'), (req, res) => {
  try {
    const shiftId = req.query.shift_id || 'SHIFT-1';
    const date = req.query.date || null;
    const lineId = req.query.line_id || null;

    const report = reportingService.getShiftReport(shiftId, date, lineId);
    return res.json(report);
  } catch (err) {
    console.error('Error generating shift report:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Generates batch progress and reconciliation report.
 * GET /api/reports/batch?batch_id=BATCH-260730-A
 */
router.get('/batch', requireAuth, requireRole('supervisor', 'administrator', 'quality_engineer', 'auditor', 'operator'), (req, res) => {
  try {
    const batchId = req.query.batch_id || 'BATCH-260730-A';
    const report = reportingService.getBatchReport(batchId);
    return res.json(report);
  } catch (err) {
    console.error('Error generating batch report:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
