class HeartbeatManager {
  constructor() {
    this.interval = null;
    this.isActive = true;
    this.lastActivity = Date.now();
    this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
    this.IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  }

  start() {
    if (this.interval) return;

    // Send initial heartbeat
    this.sendHeartbeat();

    // Set up interval
    this.interval = setInterval(() => {
      if (this.isActive) {
        this.sendHeartbeat();
      }
    }, this.HEARTBEAT_INTERVAL);

    // Set up activity listeners
    this.setupActivityListeners();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async sendHeartbeat() {
    try {
      await fetch('/auth/heartbeat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }

  setupActivityListeners() {
    const updateActivity = () => {
      const wasIdle = !this.isActive;
      this.lastActivity = Date.now();
      this.isActive = true;

      // If was idle, notify socket
      if (wasIdle && window.socketManager && window.socketManager.connected) {
        window.socketManager.emit('user:active');
      }
    };

    // Listen for user activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Check for idle state
    setInterval(() => {
      const idleTime = Date.now() - this.lastActivity;
      if (idleTime > this.IDLE_THRESHOLD && this.isActive) {
        this.isActive = false;
        
        // Notify socket about idle state
        if (window.socketManager && window.socketManager.connected) {
          window.socketManager.emit('user:away');
        }
      }
    }, 10000); // Check every 10 seconds
  }
}

// Create global heartbeat manager
window.heartbeatManager = new HeartbeatManager();

// Start heartbeat when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.heartbeatManager.start();
});

// Stop heartbeat when page unloads
window.addEventListener('beforeunload', () => {
  window.heartbeatManager.stop();
});