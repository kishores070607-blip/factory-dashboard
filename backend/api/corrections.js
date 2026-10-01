const express = require('express');
const correctionRepository = require('../persistence/repositories/correctionRepository');
const eventRepository = require('../persistence/repositories/eventRepository');
const auditRepository = require('../persistence/repositories/auditRepository');
const { requireAuth, requireRole } = require('../security/auth');
const { broadcast } = require('../realtime/websocket');

const router = express.Router();

/**
 * Void/correct an event. Allowed for 'supervisor' and 'administrator'.
 * POST /api/events/:id/void or POST /api/corrections/void
 */
router.post('/void', requireAuth, requireRole('supervisor', 'administrator'), (req, res) => {
  try {
    const { event_id, reason, type = 'void' } = req.body;
    if (!event_id || !reason) {
      return res.status(400).json({ error: 'event_id and reason are required' });
    }

    const event = eventRepository.findById(event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.status === 'manually_voided') {
      return res.status(400).json({ error: 'Event is already voided' });
    }

    const username = req.session.user.username;
    const correction = correctionRepository.create({
      event_id,
      type,
      reason,
      requested_by: username,
      approved_by: username,
      previous_status: event.status,
      new_status: 'manually_voided'
    });

    auditRepository.insert({
      actor: username,
      action: 'void_event',
      objectType: 'count_event',
      objectId: event_id,
      detail: { reason, previous_status: event.status }
    });

    broadcast('event_voided', {
      event_id,
      status: 'manually_voided',
      voided_by: username,
      reason
    });

    return res.status(200).json({ status: 'ok', correction });
  } catch (err) {
    console.error('Error voiding event:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * List historical corrections.
 * GET /api/corrections
 */
router.get('/', requireAuth, requireRole('supervisor', 'administrator', 'auditor', 'quality_engineer'), (req, res) => {
  try {
    const eventId = req.query.event_id || null;
    const corrections = correctionRepository.findAll({ event_id: eventId });
    return res.json(corrections);
  } catch (err) {
    console.error('Error fetching corrections:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
