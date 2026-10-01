const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const crypto = require('crypto');
const { createTestApp, cleanup } = require('../setup');

test.describe('Corrections API (B8)', () => {
  let app;
  let supervisorAgent;
  let operatorAgent;
  const eventId = crypto.randomUUID();

  test.before(async () => {
    app = createTestApp();
    supervisorAgent = request.agent(app);
    operatorAgent = request.agent(app);

    // Login supervisor
    await supervisorAgent
      .post('/api/auth/login')
      .send({ username: 'supervisor', password: 'supervisor123' });

    // Login operator
    await operatorAgent
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'operator123' });

    // Ingest a test event
    await request(app)
      .post('/api/v1/events/count')
      .send({
        event_id: eventId,
        device_id: 'dev-001',
        line_id: 'line-1',
        event_time: new Date().toISOString(),
        part_class: 'bearing-D'
      });
  });

  test.after(() => {
    cleanup();
  });

  test.it('POST /api/corrections/void as operator returns 403 Forbidden', async () => {
    const res = await operatorAgent
      .post('/api/corrections/void')
      .send({ event_id: eventId, reason: 'operator attempt' });
    assert.strictEqual(res.status, 403);
  });

  test.it('POST /api/corrections/void without reason returns 400 Bad Request', async () => {
    const res = await supervisorAgent
      .post('/api/corrections/void')
      .send({ event_id: eventId });
    assert.strictEqual(res.status, 400);
  });

  test.it('POST /api/corrections/void as supervisor voids event with audit trail', async () => {
    const res = await supervisorAgent
      .post('/api/corrections/void')
      .send({ event_id: eventId, reason: 'False conveyor trigger detected' });
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.correction.event_id, eventId);
    assert.strictEqual(res.body.correction.new_status, 'manually_voided');
    assert.strictEqual(res.body.correction.requested_by, 'supervisor');
  });

  test.it('GET /api/corrections returns logged correction record', async () => {
    const res = await supervisorAgent.get('/api/corrections');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const found = res.body.find(c => c.event_id === eventId);
    assert.ok(found);
    assert.strictEqual(found.reason, 'False conveyor trigger detected');
  });
});
