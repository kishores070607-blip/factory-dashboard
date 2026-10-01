const express = require('express');
const alertRepository = require('../persistence/repositories/alertRepository');
const auditRepository = require('../persistence/repositories/auditRepository');
const { broadcast } = require('../realtime/websocket');
const { requireAuth } = require('../security/auth');

const router = express.Router();

/**
 * Gets all alerts, optionally filtered by state (active|acknowledged|cleared).
 * @param {import('express').Request} req The express request object.
 * @param {import('express').Response} res The express response object.
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const { state } = req.query;
        const alerts = alertRepository.findAll({ state });
        return res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Acknowledges an alert.
 * @param {import('express').Request} req The express request object.
 * @param {import('express').Response} res The express response object.
 */
router.post('/:id/ack', requireAuth, async (req, res) => {
    try {
        const alertId = parseInt(req.params.id, 10) || req.params.id;
        const username = req.session?.user?.username || 'system';

        alertRepository.acknowledge(alertId, username);

        auditRepository.insert({
            actor: username,
            action: 'alert_acknowledged',
            objectType: 'alert',
            objectId: String(alertId)
        });

        broadcast('alert_ack', { alert_id: alertId, acknowledged_by: username });
        
        return res.status(200).json({ status: 'acknowledged', alert_id: alertId });
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
