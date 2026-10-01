const express = require('express');
const { validateCountEvent } = require('../domain/validators');
const eventRepository = require('../persistence/repositories/eventRepository');
const deviceRepository = require('../persistence/repositories/deviceRepository');
const auditRepository = require('../persistence/repositories/auditRepository');
const { broadcast } = require('../realtime/websocket');
const { requireAuth } = require('../security/auth');

const router = express.Router();

/**
 * Common ingestion handler for count events.
 */
function handleCountIngest(req, res) {
    try {
        const { valid, errors } = validateCountEvent(req.body);
        if (!valid) {
            return res.status(400).json({ errors });
        }

        const existing = eventRepository.findById(req.body.event_id);
        if (existing) {
            return res.status(200).json({ status: 'duplicate', event_id: req.body.event_id });
        }

        const received_time = new Date().toISOString();
        const eventData = {
            ...req.body,
            received_time,
            status: req.body.status || 'accepted'
        };
        
        eventRepository.insert(eventData);

        let device = deviceRepository.findById(req.body.device_id);
        if (!device) {
            device = {
                device_id: req.body.device_id,
                line_id: req.body.line_id,
                display_name: req.body.device_id,
                status: 'online',
                last_seen: received_time
            };
            deviceRepository.upsert(device);
        } else {
            deviceRepository.updateStatus(req.body.device_id, 'online', received_time);
        }

        auditRepository.insert({
            actor: 'system',
            action: 'event_ingested',
            objectType: 'count_event',
            objectId: req.body.event_id,
            timestamp: received_time
        });

        // Broadcast payload with fields mapped for UI
        const broadcastPayload = {
            ...eventData,
            id: eventData.event_id,
            timestamp: eventData.event_time,
            qty: eventData.quantity || 1
        };
        broadcast('new_event', broadcastPayload);

        return res.status(201).json({ status: 'created', event_id: req.body.event_id });
    } catch (error) {
        console.error('Error ingesting event:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Ingestion endpoints: POST / and POST /count
router.post('/', handleCountIngest);
router.post('/count', handleCountIngest);

/**
 * Event explorer endpoint: GET /
 * Filters: line, device, class, status, from, to, page, pageSize
 */
router.get('/', requireAuth, (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const pageSize = parseInt(req.query.pageSize, 10) || 50;

        const filters = {
            lineId: req.query.line || req.query.lineId || req.query.line_id,
            deviceId: req.query.device || req.query.deviceId || req.query.device_id,
            partClass: req.query.class || req.query.partClass || req.query.part_class,
            status: req.query.status,
            from: req.query.from,
            to: req.query.to,
            page,
            pageSize
        };

        const result = eventRepository.findFiltered(filters);
        const mappedData = (result.data || []).map(ev => ({
            ...ev,
            id: ev.event_id,
            timestamp: ev.event_time,
            qty: ev.quantity
        }));

        const pages = Math.ceil((result.total || 0) / pageSize) || 1;

        return res.json({
            data: mappedData,
            total: result.total,
            page,
            pageSize,
            pages
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
