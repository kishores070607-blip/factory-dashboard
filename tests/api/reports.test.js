const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createTestApp, cleanup } = require('../setup');

test.describe('Shift and Batch Reports API (B5)', () => {
  let app;
  let supervisorAgent;

  test.before(async () => {
    app = createTestApp();
    supervisorAgent = request.agent(app);

    await supervisorAgent
      .post('/api/auth/login')
      .send({ username: 'supervisor', password: 'supervisor123' });

    // Ingest events for batch
    await request(app)
      .post('/api/v1/events/count')
      .send({
        event_id: 'report-evt-1',
        device_id: 'dev-001',
        line_id: 'line-1',
        batch_id: 'BATCH-260730-A',
        shift_id: 'SHIFT-1',
        event_time: new Date().toISOString(),
        part_class: 'bearing_cap',
        quantity: 1,
        confidence: 0.98
      });
  });

  test.after(() => {
    cleanup();
  });

  test.it('GET /api/reports/meta returns available shifts, batches, and lines', async () => {
    const res = await supervisorAgent.get('/api/reports/meta');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.shifts));
    assert.ok(Array.isArray(res.body.batches));
    assert.ok(Array.isArray(res.body.lines));
  });

  test.it('GET /api/reports/shift returns target comparison and confidence breakdown', async () => {
    const res = await supervisorAgent.get('/api/reports/shift?shift_id=SHIFT-1&line_id=line-1');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.metrics);
    assert.strictEqual(typeof res.body.metrics.actualCount, 'number');
    assert.strictEqual(typeof res.body.metrics.completionPct, 'number');
    assert.ok(res.body.confidenceDistribution);
    assert.strictEqual(typeof res.body.confidenceDistribution.high, 'number');
  });

  test.it('GET /api/reports/batch returns batch reconciliation and class breakdown', async () => {
    const res = await supervisorAgent.get('/api/reports/batch?batch_id=BATCH-260730-A');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.batch.batch_id, 'BATCH-260730-A');
    assert.ok(res.body.metrics.actualCount >= 1);
    assert.ok(Array.isArray(res.body.classBreakdown));
  });
});
