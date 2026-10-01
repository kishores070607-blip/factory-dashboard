const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const crypto = require('crypto');
const { createTestApp, cleanup } = require('../setup');

test.describe('Events API', () => {
    let app;

    test.before(() => {
        app = createTestApp();
    });

    test.after(() => {
        cleanup();
    });

    const eventId = crypto.randomUUID();

    test.it('POST /api/v1/events/count with valid payload returns 201', async () => {
        const res = await request(app)
            .post('/api/v1/events/count')
            .send({
                event_id: eventId,
                device_id: 'dev-001',
                line_id: 'line-1',
                event_time: new Date().toISOString(),
                event_sequence: 1,
                part_class: 'widget-A',
                confidence: 0.95
            });
        assert.strictEqual(res.status, 201);
    });

    test.it('POST /api/v1/events/count with same event_id returns 200 (duplicate)', async () => {
        const res = await request(app)
            .post('/api/v1/events/count')
            .send({
                event_id: eventId,
                device_id: 'dev-001',
                line_id: 'line-1',
                event_time: new Date().toISOString(),
                event_sequence: 1,
                part_class: 'widget-A',
                confidence: 0.95
            });
        assert.strictEqual(res.status, 200);
    });

    test.it('POST /api/v1/events/count with missing event_id returns 400', async () => {
        const res = await request(app)
            .post('/api/v1/events/count')
            .send({
                device_id: 'dev-001',
                line_id: 'line-1'
            });
        assert.strictEqual(res.status, 400);
    });

    test.it('POST /api/v1/events/count with missing device_id returns 400', async () => {
        const res = await request(app)
            .post('/api/v1/events/count')
            .send({
                event_id: crypto.randomUUID(),
                line_id: 'line-1'
            });
        assert.strictEqual(res.status, 400);
    });

    test.it('GET /api/events without auth returns 401', async () => {
        const res = await request(app).get('/api/events');
        assert.strictEqual(res.status, 401);
    });
});
