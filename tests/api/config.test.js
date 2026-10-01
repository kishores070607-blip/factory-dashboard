const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createTestApp, cleanup } = require('../setup');

test.describe('Configuration Management API (B7 & Page 7)', () => {
  let app;
  let adminAgent;

  test.before(async () => {
    app = createTestApp();
    adminAgent = request.agent(app);

    await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
  });

  test.after(() => {
    cleanup();
  });

  test.it('GET /api/v1/config/:device_id returns active approved config for edge device', async () => {
    const res = await request(app).get('/api/v1/config/dev-001');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.device_id, 'dev-001');
    assert.strictEqual(res.body.status, 'approved');
    assert.ok(res.body.confidence_threshold);
  });

  test.it('POST /api/config/versions creates new version draft', async () => {
    const payload = {
      roi: { x_min: 100, y_min: 50, x_max: 500, y_max: 450 },
      crossing_line: { y: 250, direction: 'forward' },
      confidence_threshold: 0.90,
      model_version: 'parts-yolo-1.4.0'
    };

    const res = await adminAgent
      .post('/api/config/versions')
      .send({
        device_id: 'dev-001',
        version: '1.4.0',
        payload
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.version, '1.4.0');
    assert.strictEqual(res.body.status, 'draft');
  });

  test.it('POST /api/config/versions/:id/approve approves config version', async () => {
    // Get list
    const listRes = await adminAgent.get('/api/config/versions/list?device_id=dev-001');
    assert.strictEqual(listRes.status, 200);
    const draft = listRes.body.find(v => v.version === '1.4.0');
    assert.ok(draft);

    // Approve
    const approveRes = await adminAgent.post(`/api/config/versions/${draft.config_id}/approve`);
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.status, 'approved');

    // Verify GET /api/v1/config/dev-001 now returns 1.4.0
    const edgeRes = await request(app).get('/api/v1/config/dev-001');
    assert.strictEqual(edgeRes.body.version, '1.4.0');
    assert.strictEqual(edgeRes.body.model_version, 'parts-yolo-1.4.0');
  });
});
