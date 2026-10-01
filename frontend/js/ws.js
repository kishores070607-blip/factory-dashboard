/**
 * WebSocket client module.
 */

window.WS = {
  socket: null,
  handlers: new Map(),
  reconnectDelay: 1000,
  maxDelay: 30000,
  intentionalClose: false,

  /**
   * Connect to the live websocket.
   */
  connect() {
    this.intentionalClose = false;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws/live`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectDelay = 1000;
      this.showToast('Connected to live updates', 'success');
      this.updateStatusDot(true);
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload, timestamp } = msg;
        if (this.handlers.has(type)) {
          const callbacks = this.handlers.get(type);
          callbacks.forEach(cb => cb(payload, timestamp));
        }
      } catch (err) {
        console.error('[WS] Error parsing message', err);
      }
    };

    this.socket.onclose = () => {
      this.updateStatusDot(false);
      if (!this.intentionalClose) {
        console.warn(`[WS] Disconnected. Reconnecting in ${this.reconnectDelay}ms...`);
        this.showToast('Connection lost. Reconnecting...', 'warning');
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
      } else {
        console.log('[WS] Connection closed intentionally.');
      }
    };

    this.socket.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  },

  /**
   * Register a handler for a specific message type.
   */
  onMessage(type, callback) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(callback);
  },

  /**
   * Close the connection intentionally.
   */
  close() {
    this.intentionalClose = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const dotColor = type === 'success' ? 'var(--color-success)' : (type === 'warning' ? 'var(--color-warning)' : 'var(--color-info)');
    toast.innerHTML = `<span class="status-dot" style="background-color: ${dotColor}"></span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      if(toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  },

  updateStatusDot(connected) {
    const dot = document.getElementById('ws-status-dot');
    if (dot) {
      dot.className = `status-dot ${connected ? 'status-online' : 'status-offline'}`;
      dot.title = connected ? 'Connected to live updates' : 'Disconnected';
    }
  }
};
