const express = require('express');
const db = require('../persistence/db');

const router = express.Router();

/**
 * Liveness probe endpoint.
 * @param {import('express').Request} req The express request object.
 * @param {import('express').Response} res The express response object.
 */
router.get('/live', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

/**
 * Readiness probe endpoint.
 * @param {import('express').Request} req The express request object.
 * @param {import('express').Response} res The express response object.
 */
router.get('/ready', async (req, res) => {
    try {
        if (db && typeof db.checkConnection === 'function') {
            await db.checkConnection();
        }
        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Readiness check failed:', error);
        res.status(503).json({ status: 'unavailable', error: error.message });
    }
});

module.exports = router;
