const os = require('os');
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');

// Set temp DB path before requiring db.js
const tempDbPath = path.join(os.tmpdir(), `test-dashboard-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
process.env.DB_PATH = tempDbPath;

const { db, close } = require('../backend/persistence/db');
const { runMigrations } = require('../backend/persistence/migrate');

// Run migrations and seed data
runMigrations();

/**
 * Get the initialized test database instance.
 * @returns {Object} Database instance
 */
function getTestDb() {
    return db;
}

/**
 * Creates and configures a fresh Express app for testing.
 * @returns {Object} Express application
 */
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
    }));
    
    app.use('/api/v1/events', require('../backend/api/events'));
    app.use('/api/events', require('../backend/api/events'));
    app.use('/api/v1/devices', require('../backend/api/devices'));
    app.use('/api/devices', require('../backend/api/devices'));
    app.use('/api/v1/devices', require('../backend/api/commands'));
    app.use('/api/devices', require('../backend/api/commands'));
    app.use('/api/v1/config', require('../backend/api/config'));
    app.use('/api/config', require('../backend/api/config'));
    app.use('/api/corrections', require('../backend/api/corrections'));
    app.use('/api/reports', require('../backend/api/reports'));
    app.use('/api/auth', require('../backend/api/auth'));
    app.use('/api/lines', require('../backend/api/lines'));
    app.use('/api/alerts', require('../backend/api/alerts'));
    app.use('/api/export', require('../backend/api/export'));
    app.use('/health', require('../backend/api/health'));
    
    return app;
}

/**
 * Cleans up the test database and removes the temporary file.
 */
function cleanup() {
    try {
        close();
        if (fs.existsSync(tempDbPath)) {
            fs.unlinkSync(tempDbPath);
        }
    } catch (err) {
        // ignore
    }
}

module.exports = { getTestDb, createTestApp, cleanup };
