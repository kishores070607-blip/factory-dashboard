const WebSocket = require('ws');

let wss = null;
const clients = new Set();

/**
 * Initializes the WebSocket server attached to an HTTP server.
 * @param {object} server HTTP server
 */
function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws/live' });

  wss.on('connection', (ws, req) => {
    console.log(`[WebSocket] Client connected: ${req.socket.remoteAddress}`);
    clients.add(ws);

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${req.socket.remoteAddress}`);
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
      clients.delete(ws);
    });
  });
}

/**
 * Broadcasts a message to all connected WebSocket clients.
 * @param {string} type 
 * @param {any} payload 
 */
function broadcast(type, payload) {
  if (!wss) return;

  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString()
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

module.exports = {
  initWebSocket,
  broadcast
};
