const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createTestApp, cleanup } = require('../setup');

test.describe('Auth API', () => {
    let app;
    let agent;

    test.before(() => {
        app = createTestApp();
        agent = request.agent(app);
    });

    test.after(() => {
        cleanup();
    });

    test.it('POST /api/auth/login with valid admin credentials returns 200', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.username, 'admin');
        assert.strictEqual(res.body.role, 'administrator');
    });

    test.it('POST /api/auth/login with wrong password returns 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'wrongpassword' });
        assert.strictEqual(res.status, 401);
    });

    test.it('POST /api/auth/login with nonexistent user returns 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'nobody', password: 'password123' });
        assert.strictEqual(res.status, 401);
    });

    test.it('GET /api/auth/me without session returns 401', async () => {
        const res = await request(app).get('/api/auth/me');
        assert.strictEqual(res.status, 401);
    });

    test.it('full flow: login -> me -> logout -> me returns 401', async () => {
        // Login
        const loginRes = await agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        assert.strictEqual(loginRes.status, 200);

        // Me
        const meRes = await agent.get('/api/auth/me');
        assert.strictEqual(meRes.status, 200);
        assert.strictEqual(meRes.body.username, 'admin');

        // Logout
        const logoutRes = await agent.post('/api/auth/logout');
        assert.strictEqual(logoutRes.status, 200);

        // Me again
        const meAgainRes = await agent.get('/api/auth/me');
        assert.strictEqual(meAgainRes.status, 401);
    });
});
