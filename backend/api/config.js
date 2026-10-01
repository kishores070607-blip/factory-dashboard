const express = require('express');
const configRepository = require('../persistence/repositories/configRepository');
const auditRepository = require('../persistence/repositories/auditRepository');
const { requireAuth, requireRole } = require('../security/auth');
const { broadcast } = require('../realtime/websocket');

const router = express.Router();

/**
 * Returns approved operational configuration for edge device.
 * GET /api/v1/config/:device_id (Unauthenticated or authenticated for edge retrieval)
 */
router.get('/:device_id', (req, res) => {
  try {
    const config = configRepository.getApproved(req.params.device_id);
    if (!config) {
      return res.status(404).json({ error: 'No approved configuration found for device' });
    }
    const payload = typeof config.payload === 'string' ? JSON.parse(config.payload) : config.payload;
    return res.json({
      device_id: config.device_id,
      version: config.version,
      status: config.status,
      approved_at: config.approved_at,
      ...payload
    });
  } catch (err) {
    console.error('Error fetching device config:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * List configuration revisions for dashboard view.
 * GET /api/config/versions (or with ?device_id=...)
 */
router.get('/versions/list', requireAuth, requireRole('administrator', 'supervisor', 'maintenance_engineer', 'auditor'), (req, res) => {
  try {
    const versions = configRepository.listVersions(req.query.device_id);
    return res.json(versions);
  } catch (err) {
    console.error('Error listing config versions:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Create a new draft configuration version.
 * POST /api/config/versions
 */
router.post('/versions', requireAuth, requireRole('administrator', 'supervisor', 'maintenance_engineer'), (req, res) => {
  try {
    const { device_id, version, payload } = req.body;
    if (!device_id || !version || !payload) {
      return res.status(400).json({ error: 'device_id, version, and payload are required' });
    }

    const username = req.session.user.username;
    const draft = configRepository.createDraft({
      device_id,
      version,
      payload,
      created_by: username
    });

    auditRepository.insert({
      actor: username,
      action: 'create_config_draft',
      objectType: 'configuration_version',
      objectId: String(draft.config_id),
      detail: { device_id, version }
    });

    return res.status(201).json(draft);
  } catch (err) {
    console.error('Error creating config draft:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Approve a draft configuration version.
 * POST /api/config/versions/:id/approve
 */
router.post('/versions/:id/approve', requireAuth, requireRole('administrator', 'supervisor'), (req, res) => {
  try {
    const configId = parseInt(req.params.id, 10);
    const username = req.session.user.username;

    const approved = configRepository.approve(configId, username);
    if (!approved) {
      return res.status(404).json({ error: 'Configuration version not found' });
    }

    auditRepository.insert({
      actor: username,
      action: 'approve_config_version',
      objectType: 'configuration_version',
      objectId: String(configId),
      detail: { device_id: approved.device_id, version: approved.version }
    });

    broadcast('config_approved', {
      device_id: approved.device_id,
      version: approved.version
    });

    return res.json(approved);
  } catch (err) {
    console.error('Error approving config version:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
