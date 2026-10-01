const session = require('express-session');

/**
 * Configures express-session middleware.
 * Uses the built-in MemoryStore (fine for single-process Pi deployment).
 * @param {object} app Express application
 */
function configureSession(app) {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    }
  }));
}

module.exports = { configureSession };
