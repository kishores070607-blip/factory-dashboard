const express = require('express');
const eventRepository = require('../persistence/repositories/eventRepository');
const { requireAuth } = require('../security/auth');

const router = express.Router();

/**
 * Escapes a field for CSV safely.
 * @param {any} field The field to escape.
 * @returns {string} The escaped CSV field.
 */
function escapeCSV(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Exports events to CSV.
 * @param {import('express').Request} req The express request object.
 * @param {import('express').Response} res The express response object.
 */
router.get('/events.csv', requireAuth, (req, res) => {
    try {
        const filters = {
            lineId: req.query.line || req.query.lineId || req.query.line_id,
            deviceId: req.query.device || req.query.deviceId || req.query.device_id,
            partClass: req.query.class || req.query.partClass || req.query.part_class,
            from: req.query.from,
            to: req.query.to,
            status: req.query.status,
            pageSize: 100000,
            page: 1
        };

        const result = eventRepository.findFiltered(filters);
        const events = result.data || [];

        const now = new Date();
        const timestampStr = now.toISOString().replace(/[:.-]/g, '').substring(0, 15);
        const filename = `events_export_${timestampStr}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        // Comment line and Header
        const filterStr = JSON.stringify(filters);
        res.write(`# Exported at: ${now.toISOString()}, Timezone: UTC, Filters: ${filterStr}\n`);
        
        const headers = ['event_id', 'device_id', 'line_id', 'event_time', 'received_time', 'part_class', 'quantity', 'confidence', 'status', 'batch_id', 'shift_id'];
        res.write(headers.join(',') + '\n');

        // Stream rows
        for (const ev of events) {
            const row = headers.map(h => escapeCSV(ev[h]));
            res.write(row.join(',') + '\n');
        }

        res.end();
    } catch (error) {
        console.error('Error exporting events to CSV:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.end();
        }
    }
});

module.exports = router;
