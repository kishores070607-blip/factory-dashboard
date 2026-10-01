const express = require('express');
const { requireAuth } = require('../security/auth');
const lineRepository = require('../persistence/repositories/lineRepository');
const deviceRepository = require('../persistence/repositories/deviceRepository');
const eventRepository = require('../persistence/repositories/eventRepository');

const router = express.Router();

/**
 * Gets all lines with their aggregated summaries.
 * @param {import('express').Request} req The express request object.
 * @param {import('express').Response} res The express response object.
 */
router.get('/', requireAuth, (req, res) => {
    try {
        const lines = lineRepository.findAll();
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

        const summaries = lines.map((line) => {
            const lineId = line.line_id;
            const devices = deviceRepository.findByLine(lineId);
            const countToday = eventRepository.countByLine(lineId, startOfToday.toISOString());
            const recentEvents = eventRepository.recentByLine(lineId, 60);
            
            let status = 'ok';
            if (devices.some(d => d.status === 'offline')) {
                status = 'critical';
            } else if (devices.some(d => d.status === 'stale')) {
                status = 'warning';
            } else if (devices.length === 0) {
                status = 'unknown';
            }

            return {
                ...line,
                line_id: lineId,
                id: lineId,
                deviceCount: devices.length,
                devices: devices.map(d => ({
                    ...d,
                    id: d.device_id,
                    name: d.display_name || d.device_id
                })),
                countToday,
                total_count_today: countToday,
                rate_per_min: recentEvents.length,
                ratePerMinute: recentEvents.length,
                status
            };
        });

        return res.json(summaries);
    } catch (error) {
        console.error('Error fetching lines:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Gets detailed overview for a specific line.
 * @param {import('express').Request} req The express request object.
 * @param {import('express').Response} res The express response object.
 */
router.get('/:id/overview', requireAuth, (req, res) => {
    try {
        const line = lineRepository.findById(req.params.id);
        if (!line) {
            return res.status(404).json({ error: 'Line not found' });
        }

        const lineId = line.line_id;
        const devices = deviceRepository.findByLine(lineId);
        
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const countToday = eventRepository.countByLine(lineId, startOfToday.toISOString());

        const recentEvents = eventRepository.recentByLine(lineId, 60);
        
        let lastEventTime = null;
        if (recentEvents.length > 0) {
            lastEventTime = recentEvents[0].event_time;
        }

        return res.json({
            line: {
                ...line,
                id: lineId
            },
            devices: devices.map(d => ({
                ...d,
                id: d.device_id,
                name: d.display_name || d.device_id
            })),
            totalToday: countToday,
            total_count_today: countToday,
            ratePerMinute: recentEvents.length,
            rate_per_min: recentEvents.length,
            lastEventTime
        });
    } catch (error) {
        console.error('Error fetching line overview:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
