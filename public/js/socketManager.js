let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

class SocketManager {
  constructor() {
    this.listeners = new Map();
    this.connected = false;
  }

  async connect() {
    if (socket && socket.connected) {
      console.log("Socket already connected");
      return;
    }

    try {
      // Import socket.io client
      if (typeof io === "undefined") {
        console.error("Socket.io client not loaded");
        return;
      }

      socket = io({
        withCredentials: true,
        reconnection: true,
        reconnectionDelay: RECONNECT_DELAY,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      });

      this.setupBaseListeners();
    } catch (error) {
      console.error("Failed to connect socket:", error);
    }
  }

  setupBaseListeners() {
    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      this.connected = true;
      reconnectAttempts = 0;

      const roomIdMatch = window.location.pathname.match(/\/room\/([^\/]+)/);
      if (roomIdMatch) {
        const roomId = roomIdMatch[1];
        setTimeout(() => {
          this.emit("room:join", roomId);
        }, 500);
      }

      // Rejoin any active rooms
      if (window.roomUtils && window.roomUtils.getCurrentRoom()) {
        const room = window.roomUtils.getCurrentRoom();
        setTimeout(() => {
          this.emit("room:join", room.roomId);
        }, 2000);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      this.connected = false;

      if (reason === "io server disconnect") {
        // Server disconnected us, try to reconnect
        setTimeout(() => this.connect(), RECONNECT_DELAY);
      }
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      reconnectAttempts++;

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error("Max reconnection attempts reached");
        showNotification("Connection lost. Please refresh the page.", "error");
      }
    });

    // Notification events
    socket.on("notification:new", (notification) => {
      console.log("New notification received:", notification);
      this.handleNewNotification(notification);
    });

    socket.on("notification:update", (data) => {
      console.log("Notification updated:", data);
      this.handleNotificationUpdate(data);
    });

    socket.on("notification:markAllRead", (data) => {
      console.log("All notifications marked as read:", data);
      this.handleMarkAllNotificationsRead(data);
    });

    socket.on("notification:delete", (data) => {
      console.log("Notification deleted:", data);
      this.handleNotificationDelete(data);
    });

    socket.on("notification:stats", (stats) => {
      console.log("Notification stats updated:", stats);
      this.handleNotificationStats(stats);
    });

    // Room events
    socket.on("room:playerJoined", (data) => {
      console.log("Player joined room:", data);
      this.handlePlayerJoined(data);
    });

    socket.on("room:playerLeft", (data) => {
      console.log("Player left room:", data);
      this.handlePlayerLeft(data);
    });

    socket.on("room:settingsUpdated", (data) => {
      console.log("Room settings updated:", data);
      this.handleRoomSettingsUpdate(data);
    });

    socket.on("room:invitation", (data) => {
      console.log("Room invitation received:", data);
      this.handleRoomInvitation(data);
    });

    // User status events
    socket.on("friend:statusUpdate", (data) => {
      console.log("Friend status updated:", data);
      this.handleFriendStatusUpdate(data);
    });
  }

  // Notification handlers
  handleNewNotification(notification) {
    // Add to notification list if on notifications page
    if (
      window.location.pathname === "/notifications" &&
      window.notificationUtils
    ) {
      window.notificationUtils.loadNotifications(
        window.notificationUtils.getCurrentPage()
      );
    }

    // Show desktop notification
    showNotification(notification.message, "info");

    // Play notification sound if enabled
    this.playNotificationSound();
  }

  handleMarkAllNotificationsRead(data) {
    // Remove unread styling from all notifications
    document.querySelectorAll(".notification-item.unread").forEach((item) => {
      item.classList.remove("unread");
      const badge = item.querySelector(".notification-badge");
      if (badge) badge.remove();
      const readIcon = item.querySelector(".notification-read");
      if (readIcon) readIcon.remove();
      const actions = item.querySelector(".notification-actions");
      if (actions) actions.remove();
    });

    // Show feedback
    if (data.count > 0) {
      showNotification(`${data.count} notifications marked as read`, "success");
    }
  }

  handleNotificationUpdate(data) {
    // Update notification in UI if visible
    const notificationEl = document.querySelector(
      `[data-id="${data.notificationId}"]`
    );
    if (notificationEl && data.update.isRead) {
      notificationEl.classList.remove("unread");
      const badge = notificationEl.querySelector(".notification-badge");
      if (badge) badge.remove();
      const readIcon = notificationEl.querySelector(".notification-read");
      if (readIcon) readIcon.remove();
    }
  }

  handleNotificationDelete(data) {
    const notificationEl = document.querySelector(
      `[data-id="${data.notificationId}"]`
    );
    if (notificationEl) {
      notificationEl.style.opacity = "0.5";
      notificationEl.style.transform = "translateX(-20px)";
      setTimeout(() => notificationEl.remove(), 300);
    }
  }

  handleNotificationStats(stats) {
    // Update stats in UI
    if (window.notificationUtils) {
      window.notificationUtils.displayNotificationStats(stats);
    }
  }

  // Room handlers
  handlePlayerJoined(data) {
    if (window.roomUtils && window.roomUtils.getCurrentRoom()) {
      // Update room UI
      window.roomUtils.refresh();

      // Show notification
      if (data.player && data.player.user) {
        showNotification(
          `${data.player.user.username} joined the room`,
          "info"
        );
      }
    }
  }

  handlePlayerLeft(data) {
    if (window.roomUtils && window.location.pathname.includes("/room/")) {
      window.roomUtils.handlePlayerLeft(data);
    }
  }

  handleRoomSettingsUpdate(data) {
    if (window.roomUtils && window.roomUtils.getCurrentRoom()) {
      window.roomUtils.handleSettingsUpdate(data);
    }
  }

  handleRoomInvitation(data) {
    showNotification(`You've been invited to join a room!`, "info");
    this.playNotificationSound();
  }

  // Friend status handler
  handleFriendStatusUpdate(data) {
    // Update friend status in UI if on friends page
    if (window.location.pathname.includes("/friends")) {
      const friendEl = document.querySelector(
        `[data-friend-id="${data.userId}"]`
      );
      if (friendEl) {
        const statusEl = friendEl.querySelector(".friend-status");
        if (statusEl) {
          statusEl.textContent = data.status;
          statusEl.className = `friend-status ${data.status}`;
        }
      }
    }
  }

  // Utility methods
  emit(event, data) {
    if (socket && socket.connected) {
      socket.emit(event, data);
    } else {
      console.warn("Socket not connected, cannot emit:", event);
    }
  }

  on(event, callback) {
    if (socket) {
      socket.on(event, callback);

      // Store listener for cleanup
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  off(event, callback) {
    if (socket) {
      socket.off(event, callback);

      // Remove from stored listeners
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  disconnect() {
    if (socket) {
      // Clean up all listeners
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          socket.off(event, callback);
        });
      });
      this.listeners.clear();

      socket.disconnect();
      socket = null;
      this.connected = false;
    }
  }

  playNotificationSound() {
    // Play notification sound if available
    const audio = document.getElementById("notificationSound");
    if (audio) {
      audio
        .play()
        .catch((e) => console.log("Could not play notification sound:", e));
    }
  }
}

window.socketManager = new SocketManager();
