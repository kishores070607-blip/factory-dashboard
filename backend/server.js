const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');

const { runMigrations } = require('./persistence/migrate');
const { close } = require('./persistence/db');
const { configureSession } = require('./security/session');
const { initWebSocket } = require('./realtime/websocket');

async function startServer() {
  console.log('Starting Dashboard Platform...');
  
  // 1. Run migrations
  try {
    runMigrations();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }

  // 2. Create express app
  const app = express();
  
  // 3. Configure session
  configureSession(app);

  // 4. Parse JSON
  app.use(express.json());

  // 5. Serve static files
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  // 6. Mount API routes
  const eventsRouter = require('./api/events');
  const devicesRouter = require('./api/devices');
  const commandsRouter = require('./api/commands');
  const configRouter = require('./api/config');
  const correctionsRouter = require('./api/corrections');
  const reportsRouter = require('./api/reports');
  const authRouter = require('./api/auth');
  const linesRouter = require('./api/lines');
  const alertsRouter = require('./api/alerts');
  const exportRouter = require('./api/export');
  const healthRouter = require('./api/health');

  app.use('/api/v1/events', eventsRouter);
  app.use('/api/events', eventsRouter);

  app.use('/api/v1/devices', devicesRouter);
  app.use('/api/devices', devicesRouter);

  app.use('/api/v1/devices', commandsRouter);
  app.use('/api/devices', commandsRouter);

  app.use('/api/v1/config', configRouter);
  app.use('/api/config', configRouter);

  app.use('/api/corrections', correctionsRouter);
  app.use('/api/reports', reportsRouter);

  app.use('/api/auth', authRouter);
  app.use('/api/lines', linesRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/export', exportRouter);
  app.use('/health', healthRouter);

  // 7. Create HTTP server
  const server = http.createServer(app);

  // 8. Init WebSocket
  initWebSocket(server);

  // 9. Start staleness checker
  try {
    const { startStalenessChecker } = require('./services/staleness');
    startStalenessChecker();
  } catch (e) {
    console.warn('Missing staleness checker service', e);
  }

  // 10. Listen
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed.');
      close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();
