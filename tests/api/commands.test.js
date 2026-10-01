const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createTestApp, cleanup } = require('../setup');

test.describe('Edge Commands API (Handbook Page 7)', () => {
  let app;
  let maintAgent;

  test.before(async () => {
    app = createTestApp();
    maintAgent = request.agent(app);

    await maintAgent
      .post('/api/auth/login')
      .send({ username: 'maintenance', password: 'maint123' });
  });

  test.after(() => {
    cleanup();
  });

  test.it('POST /api/devices/:device_id/dispatch queues remote command', async () => {
    const res = await maintAgent
      .post('/api/devices/dev-001/dispatch')
      .send({ command_type: 'reset_diagnostics', payload: { mode: 'full' } });
    
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.command_type, 'reset_diagnostics');
    assert.strictEqual(res.body.status, 'pending');
  });

  test.it('GET /api/v1/devices/:device_id/commands returns pending commands to edge device', async () => {
    const res = await request(app).get('/api/v1/devices/dev-001/commands');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const pending = res.body.find(c => c.command_type === 'reset_diagnostics');
    assert.ok(pending);
    assert.strictEqual(pending.status, 'pending');

    // Edge device executes and acknowledges command
    const ackRes = await request(app).post(`/api/v1/devices/dev-001/commands/${pending.command_id}/ack`);
    assert.strictEqual(ackRes.status, 200);
    assert.strictEqual(ackRes.body.status, 'acknowledged');

    // Query pending again - should be empty now
    const afterRes = await request(app).get('/api/v1/devices/dev-001/commands');
    assert.strictEqual(afterRes.status, 200);
    const stillPending = afterRes.body.find(c => c.command_id === pending.command_id);
    assert.strictEqual(stillPending, undefined);
  });
});
