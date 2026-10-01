const express = require('express');
const { validateHealthSample } = require('../domain/validators');
const deviceRepository = require('../persistence/repositories/deviceRepository');
const healthRepository = require('../persistence/repositories/healthRepository');
const { broadcast } = require('../realtime/websocket');
const { requireAuth } = require('../security/auth');

const router = express.Router();

/**
 * Ingests a health sample from a device.
 */
router.post('/health', (req, res) => {
    try {
        const { valid, errors } = validateHealthSample(req.body);
        if (!valid) {
            return res.status(400).json({ errors });
        }

        const sample = {
            ...req.body,
            timestamp: req.body.timestamp || new Date().toISOString()
        };

        healthRepository.insert(sample);

        const device = deviceRepository.findById(req.body.device_id);
        if (!device) {
            deviceRepository.upsert({
                device_id: req.body.device_id,
                display_name: req.body.device_id,
                status: 'online',
                last_seen: sample.timestamp
            });
        } else {
            deviceRepository.updateStatus(req.body.device_id, 'online', sample.timestamp);
        }
        
        broadcast('health_update', sample);
        broadcast('device_status', { device_id: req.body.device_id, status: 'online' });
        
        return res.status(201).json({ status: 'created' });
    } catch (error) {
        console.error('Error saving health sample:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Gets all devices.
 */
router.get('/', requireAuth, (req, res) => {
    try {
        const devices = deviceRepository.findAll();
        const mapped = devices.map(d => ({
            ...d,
            id: d.device_id,
            name: d.display_name || d.device_id
        }));
        return res.json(mapped);
    } catch (error) {
        console.error('Error fetching devices:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Gets a single device by ID along with its latest health sample.
 */
router.get('/:id', requireAuth, (req, res) => {
    try {
        const device = deviceRepository.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        const latestHealth = healthRepository.latestByDevice(req.params.id);
        return res.json({
            ...device,
            id: device.device_id,
            name: device.display_name || device.device_id,
            latestHealth
        });
    } catch (error) {
        console.error('Error fetching device:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Gets the last 50 health samples for a device.
 */
router.get('/:id/health', requireAuth, (req, res) => {
    try {
        const samples = healthRepository.findByDevice(req.params.id, 50);
        return res.json(samples);
    } catch (error) {
        console.error('Error fetching health samples:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
