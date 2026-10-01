const express = require('express');
const commandRepository = require('../persistence/repositories/commandRepository');
const auditRepository = require('../persistence/repositories/auditRepository');
const { requireAuth, requireRole } = require('../security/auth');
const { broadcast } = require('../realtime/websocket');

const router = express.Router();

/**
 * Edge device polls for pending commands.
 * GET /api/v1/devices/:device_id/commands
 */
router.get('/:device_id/commands', (req, res) => {
  try {
    const commands = commandRepository.getPending(req.params.device_id);
    return res.json(commands);
  } catch (err) {
    console.error('Error fetching pending commands:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Edge device acknowledges command execution.
 * POST /api/v1/devices/:device_id/commands/:id/ack
 */
router.post('/:device_id/commands/:id/ack', (req, res) => {
  try {
    const commandId = parseInt(req.params.id, 10);
    const command = commandRepository.acknowledge(commandId);
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }

    broadcast('command_ack', {
      command_id: commandId,
      device_id: req.params.device_id,
      command_type: command.command_type
    });

    return res.json({ status: 'acknowledged', command_id: commandId });
  } catch (err) {
    console.error('Error acknowledging command:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Maintenance/Admin dispatches a new command to a device.
 * POST /api/devices/:device_id/commands
 */
router.post('/:device_id/dispatch', requireAuth, requireRole('maintenance_engineer', 'administrator'), (req, res) => {
  try {
    const { command_type, payload } = req.body;
    if (!command_type) {
      return res.status(400).json({ error: 'command_type is required' });
    }

    const command = commandRepository.enqueue({
      device_id: req.params.device_id,
      command_type,
      payload
    });

    auditRepository.insert({
      actor: req.session.user.username,
      action: 'dispatch_device_command',
      objectType: 'device_command',
      objectId: String(command.command_id),
      detail: { device_id: req.params.device_id, command_type }
    });

    broadcast('command_dispatched', {
      device_id: req.params.device_id,
      command_type,
      command_id: command.command_id
    });

    return res.status(201).json(command);
  } catch (err) {
    console.error('Error dispatching command:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * List command history.
 * GET /api/devices/commands/history
 */
router.get('/history/all', requireAuth, requireRole('maintenance_engineer', 'administrator', 'auditor'), (req, res) => {
  try {
    const history = commandRepository.findAll(50);
    return res.json(history);
  } catch (err) {
    console.error('Error fetching command history:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
