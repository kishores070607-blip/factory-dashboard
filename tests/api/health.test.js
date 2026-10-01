const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createTestApp, cleanup } = require('../setup');

test.describe('Health API', () => {
    let app;

    test.before(() => {
        app = createTestApp();
    });

    test.after(() => {
        cleanup();
    });

    test.it('GET /health/live returns 200 with status ok', async () => {
        const res = await request(app).get('/health/live');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });

    test.it('GET /health/ready returns 200 when db is connected', async () => {
        const res = await request(app).get('/health/ready');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });
});
