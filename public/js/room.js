let currentRoom = null;
let roomCode = null;
let currentUserId = null;

function setupRoomSocketHandlers() {
  if (!currentRoom) return;

  if (!window.socketManager) {
    console.error("SocketManager not initialized");
    return;
  }

  // Function to join room channel
  const joinRoomChannel = () => {
    if (window.socketManager.connected) {
      window.socketManager.emit("room:join", currentRoom.roomId);
      console.log(`Joined room channel: ${currentRoom.roomId}`);
    } else {
      console.log("Socket not ready, waiting for connection...");
      const connectHandler = () => {
        window.socketManager.emit("room:join", currentRoom.roomId);
        console.log(`Joined room channel after connect: ${currentRoom.roomId}`);
        window.socketManager.off("connect", connectHandler);
      };
      window.socketManager.on("connect", connectHandler);
    }
  };

  joinRoomChannel();

  window.socketManager.on("room:playerJoined", handlePlayerJoined);
  window.socketManager.on("room:playerLeft", handlePlayerLeft);
  window.socketManager.on("room:settingsUpdated", handleSettingsUpdate);

  // Setup leave handler when leaving page
  window.addEventListener("beforeunload", () => {
    if (currentRoom && currentRoom.roomId) {
      window.socketManager.emit("room:leave", currentRoom.roomId);
    }
  });
}

function initLeaveModal() {
  const modal = document.getElementById("leaveModal");
  const cancelBtn = document.getElementById("cancelLeave");
  const confirmBtn = document.getElementById("confirmLeave");
  const modalOverlay = modal.querySelector(".modal-overlay");

  function showLeaveModal() {
    const messageEl = document.getElementById("leaveMessage");
    const warningEl = document.getElementById("leaveWarning");
    const warningText = document.getElementById("warningText");

    // Reset modal state
    warningEl.style.display = "none";

    // Customize message based on user role
    if (currentRoom?.isHost && currentRoom?.currentPlayers > 1) {
      messageEl.textContent = "Are you sure you want to leave this room?";
      warningEl.style.display = "block";
      warningText.textContent =
        "You are the host. Another player will become the host.";
    } else if (currentRoom?.isHost && currentRoom?.currentPlayers === 1) {
      messageEl.textContent = "Are you sure you want to leave?";
      warningEl.style.display = "block";
      warningText.textContent =
        "You are the only player. The room will be closed.";
    } else {
      messageEl.textContent = "Are you sure you want to leave this room?";
    }

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }

  // Event listeners
  cancelBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);

  confirmBtn.addEventListener("click", () => {
    closeModal();
    leaveRoom();
  });

  // Update back button handler
  const backButton = document.querySelector(".back-button");
  if (backButton) {
    backButton.addEventListener("click", (e) => {
      e.preventDefault();
      showLeaveModal();
    });
  }
  window.addEventListener("beforeunload", (e) => {
    if (currentRoom && currentRoom.status === "waiting") {
      e.preventDefault();
      showLeaveModal();
    }
  });
  return { showLeaveModal };
}

function initSettingsModal() {
  const settingsBtn = document.querySelector(".settings-btn");
  const modal = document.getElementById("settingsModal");
  const closeBtn = document.getElementById("closeSettingsModal");
  const cancelBtn = document.getElementById("cancelSettingsBtn");
  const saveBtn = document.getElementById("saveSettingsBtn");
  const modalOverlay = modal.querySelector(".modal-overlay");

  // Current settings state
  let currentSettings = {
    wordLength: 5,
    maxTries: 6,
    maxPlayers: 2,
    language: "us",
    preset: "classic",
  };

  // Initialize settings from current room
  function initializeSettings() {
    if (currentRoom) {
      currentSettings = {
        wordLength: currentRoom.settings?.wordLength || 5,
        maxTries: currentRoom.settings?.maxTries || 6,
        maxPlayers: currentRoom.settings?.maxPlayers || 2,
        language: currentRoom.settings?.language || "us",
        preset: "classic",
      };
    }
    updateUI();
  }

  // Update UI elements
  function updateUI() {
    // Update selects
    document.getElementById("wordLengthSelect").value =
      currentSettings.wordLength;
    document.getElementById("languageSelect").value = currentSettings.language;

    // Update tries display
    document.getElementById("triesDisplay").textContent =
      currentSettings.maxTries;

    // Update player options
    document.querySelectorAll(".player-option").forEach((btn) => {
      btn.classList.toggle(
        "selected",
        parseInt(btn.dataset.players) === currentSettings.maxPlayers
      );
    });

    // Update difficulty preview
    updateDifficultyPreview();
  }

  function updateDifficultyPreview() {
    const stats = document.querySelectorAll(".difficulty-stat .stat-number");
    stats[0].textContent = currentSettings.wordLength;
    stats[1].textContent = currentSettings.maxTries;
    stats[2].textContent = currentSettings.maxPlayers;
    stats[3].textContent = currentSettings.language.toUpperCase();

    // Update difficulty badge
    const badge = document.querySelector(".difficulty-badge");
    if (currentSettings.wordLength === 4 && currentSettings.maxTries === 8) {
      badge.textContent = "Easy Mode";
    } else if (
      currentSettings.wordLength === 7 &&
      currentSettings.maxTries === 4
    ) {
      badge.textContent = "Challenge";
    } else {
      badge.textContent = "Classic";
    }
  }

  // Word length select
  document
    .getElementById("wordLengthSelect")
    .addEventListener("change", (e) => {
      currentSettings.wordLength = parseInt(e.target.value);
      updateDifficultyPreview();
    });

  // Language select
  document.getElementById("languageSelect").addEventListener("change", (e) => {
    currentSettings.language = e.target.value;
    updateDifficultyPreview();
  });

  // Tries increment/decrement
  document.getElementById("increaseTries").addEventListener("click", () => {
    if (currentSettings.maxTries < 10) {
      currentSettings.maxTries++;
      document.getElementById("triesDisplay").textContent =
        currentSettings.maxTries;
      updateDifficultyPreview();
    }
  });

  document.getElementById("decreaseTries").addEventListener("click", () => {
    if (currentSettings.maxTries > 3) {
      currentSettings.maxTries--;
      document.getElementById("triesDisplay").textContent =
        currentSettings.maxTries;
      updateDifficultyPreview();
    }
  });

  // Player options
  document.querySelectorAll(".player-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".player-option")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      currentSettings.maxPlayers = parseInt(btn.dataset.players);
      updateDifficultyPreview();
    });
  });

  // Preset options
  document.querySelectorAll(".preset-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".preset-option")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      const preset = btn.dataset.preset;
      currentSettings.preset = preset;

      // Apply preset settings
      if (preset === "easy") {
        currentSettings.wordLength = 4;
        currentSettings.maxTries = 8;
        currentSettings.maxPlayers = 2;
      } else if (preset === "challenge") {
        currentSettings.wordLength = 7;
        currentSettings.maxTries = 4;
        currentSettings.maxPlayers = 4;
      } else {
        // classic
        currentSettings.wordLength = 5;
        currentSettings.maxTries = 6;
        currentSettings.maxPlayers = 2;
      }

      updateUI();
    });
  });

  // Open modal
  settingsBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // Only host can change settings
    if (!currentRoom?.isHost) {
      showNotification("Only the host can change settings", "warning");
      return;
    }

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    initializeSettings();
  });

  // Close modal function
  function closeModal() {
    modal.style.display = "none";
    document.body.style.overflow = "";
    initializeSettings(); // Reset to original settings
  }

  // Close modal events
  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") {
      closeModal();
    }
  });

  // Save settings
  saveBtn.addEventListener("click", async () => {
    if (!currentRoom) return;

    const validation = validateRoomData(currentSettings);
    if (!validation.isValid) {
      showNotification(validation.error, "error");
      return;
    }

    const originalContent = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
      const response = await fetch(`/api/room/${currentRoom.roomId}/settings`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(currentSettings),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification("Settings updated successfully", "success");
        closeModal();

        // Update current room data
        if (currentRoom.settings) {
          handleSettingsUpdate(data);
          Object.assign(currentRoom.settings, currentSettings);
        }

        // Refresh room UI
        fetchRoomDetails();
      } else {
        showNotification(data.message || "Failed to update settings", "error");
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      showNotification("Failed to update settings", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalContent;
    }
  });
}

function handleSettingsUpdate(data) {
  if (!currentRoom) return;

  currentRoom.settings = data.settings;
  currentRoom.status = data.roomStatus;

  updateRoomUI(currentRoom);

  if (data.updatedBy && data.updatedBy !== currentRoom.username) {
    showNotification(`${data.updatedBy} updated room settings`, "info");
  }
}

function validateRoomData(settings) {
  if (!settings) {
    return {
      isValid: false,
      error: "Invalid room data",
    };
  }

  if (![4, 5, 6, 7].includes(settings.wordLength)) {
    return {
      isValid: false,
      error: "Invalid word length selected",
    };
  }

  if (![2, 3, 4].includes(settings.maxPlayers)) {
    return {
      isValid: false,
      error: "Invalid number of players selected",
    };
  }

  const validLanguages = ["en", "ar", "zh", "de", "es", "fr"];
  if (!validLanguages.includes(settings.language)) {
    return {
      isValid: false,
      error: "Invalid language selected",
    };
  }

  if (![3, 4, 5, 6, 7, 8, 9, 10].includes(settings.maxTries)) {
    return {
      isValid: false,
      error: "Invalid number of tries selected",
    };
  }

  return {
    isValid: true,
  };
}

function handlePlayerJoined(data) {
  if (!currentRoom) return;

  const { player, currentPlayers, isFull } = data;

  currentRoom.players.push(player);
  currentRoom.currentPlayers = currentPlayers;
  currentRoom.isFull = isFull;

  updateRoomUI(currentRoom);

  if (player.user._id !== currentUserId) {
    showNotification(`${player.user.username} joined the room`, "info");
  }

  refreshAvailableFriends();
}

function handlePlayerLeft(data) {
  if (!currentRoom) return;

  const { userId, username, newHost, roomStatus, remainingPlayers } = data;

  // Update current room data
  currentRoom.players = currentRoom.players.filter(
    (player) => player.user._id !== userId
  );
  currentRoom.currentPlayers = remainingPlayers || currentRoom.players.length;
  currentRoom.status = roomStatus;

  if (newHost) {
    currentRoom.players.forEach((player) => {
      player.isHost = player.user._id === newHost;
    });

    if (newHost === currentUserId) {
      currentRoom.isHost = true;
      showNotification("You are now the room host", "info");
    } else {
      currentRoom.isHost = false;
    }
  }

  currentRoom.isFull =
    currentRoom.currentPlayers >= currentRoom.settings.maxPlayers;

  updateRoomUI(currentRoom);
  if (username) {
    showNotification(`${username} left the room`, "info");
  }

  refreshAvailableFriends();
  // Handle room closed
  if (roomStatus === "closed") {
    showNotification("Room has been closed", "warning");
    sessionStorage.removeItem("currentRoom");
    setTimeout(() => {
      window.location.href = "/lobby";
    }, 2000);
  }
}

async function leaveRoom() {
  if (!currentRoom) return;

  try {
    const response = await fetch(`/api/room/${currentRoom.roomId}/leave`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    if (response.ok) {
      handlePlayerLeft(data);
      showNotification("Left the room", "success");
      sessionStorage.removeItem("currentRoom");
      window.location.href = "/lobby";
    } else {
      const error = await response.json();
      showNotification(`Failed to leave room: ${error.message}`, "error");
    }
  } catch (error) {
    console.error("Error leaving room:", error);
    showNotification("Failed to leave room", "error");
  }
}

async function copyRoomCode() {
  const code = roomCode || "ABCDEF";
  const copyBtn = document.querySelector(".copy-btn");

  if (!copyBtn) {
    console.warn("Copy button not found");
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    showCopyFeedback(copyBtn);
  } catch (error) {
    console.error("Failed to copy room code:", error);
    // Fallback for browsers that don't support clipboard API
    fallbackCopyToClipboard(code);
    showCopyFeedback(copyBtn);
  }
}

function fallbackCopyToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
  } catch (error) {
    console.error("Fallback copy failed:", error);
  }

  document.body.removeChild(textArea);
}

function showCopyFeedback(copyBtn) {
  const originalHtml = copyBtn.innerHTML;
  copyBtn.innerHTML = '<i class="fas fa-check"></i>';
  copyBtn.disabled = true;

  setTimeout(() => {
    copyBtn.innerHTML = originalHtml;
    copyBtn.disabled = false;
  }, 2000);
}

function initInviteModal() {
  const inviteBtn = document.querySelector(".invite-btn");
  const modal = document.getElementById("inviteModal");
  const closeBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const modalOverlay = document.querySelector(".modal-overlay");
  const inviteModalBtn = document.getElementById("inviteBtn");
  const friendSearch = document.getElementById("friendSearch");

  // Store selectedFriends in closure instead of window
  let selectedFriends = new Set();
  let availableFriends = [];

  // Prevent duplicate event listeners
  let listenersAttached = false;

  async function loadAvailableFriends() {
    if (!currentRoom) return;

    const friendsList = document.getElementById("friendsList");

    // Show loading state
    friendsList.innerHTML = `
      <div class="loading-friends">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading friends...</p>
      </div>
    `;

    try {
      const response = await fetch(
        `/api/room/${currentRoom.roomId}/available-friends`,
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        availableFriends = data.friends || [];
        updateFriendsDisplay(availableFriends);
      } else {
        console.error("Failed to load friends");
        availableFriends = [];
        updateFriendsDisplay([]);
      }
    } catch (error) {
      console.error("Error loading friends:", error);
      availableFriends = [];
      updateFriendsDisplay([]);
    }
  }

  function updateFriendsDisplay(friends) {
    const friendsList = document.getElementById("friendsList");
    const onlineCount = document.querySelector(".invite-friends-section h4");

    if (onlineCount) {
      onlineCount.textContent = `Online Friends (${friends.length})`;
    }

    // Check if room is full
    if (currentRoom && currentRoom.isFull) {
      friendsList.innerHTML = `
        <div class="no-friends-message">
          <i class="fas fa-user-slash"></i>
          <p>Room is full</p>
          <span style="font-size: 14px; opacity: 0.8;">No more players can join</span>
        </div>
      `;
      return;
    }

    if (friends.length === 0) {
      friendsList.innerHTML = `
        <div class="no-friends-message">
          <i class="fas fa-user-friends"></i>
          <p>No online friends available to invite</p>
          <span style="font-size: 14px; opacity: 0.8;">Your online friends will appear here</span>
        </div>
      `;
      return;
    }

    // Calculate available slots
    const availableSlots =
      currentRoom.settings.maxPlayers - currentRoom.currentPlayers;

    friendsList.innerHTML = friends
      .map(
        (friend) => `
      <div class="friend-item" data-friend-name="${friend.username.toLowerCase()}">
        <div class="friend-avatar">${friend.username
          .charAt(0)
          .toUpperCase()}</div>
        <div class="friend-info">
          <span class="friend-name">${friend.username}</span>
          <span class="friend-status ${friend.isOnline ? "online" : "offline"}">
            <i class="fas fa-circle" style="font-size: 8px; margin-right: 4px;"></i>
            ${friend.isOnline ? "Online" : "Recently Active"}
          </span>
        </div>
        <button class="invite-friend-btn" 
                data-friend-id="${friend.id}" 
                data-friend="${friend.username}"
                ${selectedFriends.has(friend.id) ? 'class="selected"' : ""}>
          ${
            selectedFriends.has(friend.id)
              ? '<i class="fas fa-check"></i>'
              : '<i class="fas fa-plus"></i>'
          }
        </button>
      </div>
    `
      )
      .join("");

    // Add warning if limited slots
    if (availableSlots < friends.length && availableSlots > 0) {
      const warning = document.createElement("div");
      warning.className = "slots-warning";
      warning.innerHTML = `
        <i class="fas fa-info-circle"></i>
        Only ${availableSlots} more player${
        availableSlots === 1 ? "" : "s"
      } can join
      `;
      friendsList.insertBefore(warning, friendsList.firstChild);
    }

    attachInviteButtonListeners();
  }

  function attachInviteButtonListeners() {
    const inviteFriendBtns = document.querySelectorAll(".invite-friend-btn");

    // Remove old listeners to prevent duplicates
    inviteFriendBtns.forEach((btn) => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });

    // Attach new listeners
    document.querySelectorAll(".invite-friend-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const friendId = btn.dataset.friendId;
        const friendName = btn.dataset.friend;

        // Check available slots
        const availableSlots =
          currentRoom.settings.maxPlayers - currentRoom.currentPlayers;

        if (
          !selectedFriends.has(friendId) &&
          selectedFriends.size >= availableSlots
        ) {
          showNotification(
            `Can only invite ${availableSlots} more player${
              availableSlots === 1 ? "" : "s"
            }`,
            "warning"
          );
          return;
        }

        if (selectedFriends.has(friendId)) {
          selectedFriends.delete(friendId);
          btn.classList.remove("selected");
          btn.innerHTML = '<i class="fas fa-plus"></i>';
        } else {
          selectedFriends.add(friendId);
          btn.classList.add("selected");
          btn.innerHTML = '<i class="fas fa-check"></i>';
        }

        updateInviteButton();
      });
    });
  }

  function updateInviteButton() {
    if (selectedFriends.size > 0) {
      inviteModalBtn.disabled = false;
      inviteModalBtn.textContent = `Invite (${selectedFriends.size})`;
    } else {
      inviteModalBtn.disabled = true;
      inviteModalBtn.textContent = "Invite";
    }
  }

  async function sendInvitations() {
    if (!currentRoom || selectedFriends.size === 0) return;

    const originalContent = inviteModalBtn.innerHTML;
    inviteModalBtn.disabled = true;
    inviteModalBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      const friendIds = Array.from(selectedFriends);
      const response = await fetch(`/api/room/${currentRoom.roomId}/invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.invited > 0) {
          showNotification(`Sent ${data.invited} invitation(s)`, "success");
        }
        if (data.alreadyInvited > 0) {
          showNotification(`${data.alreadyInvited} already invited`, "info");
        }
        if (data.alreadyInRoom > 0) {
          showNotification(`${data.alreadyInRoom} already in room`, "info");
        }
        closeModal();
      } else {
        showNotification(data.message || "Failed to send invitations", "error");
      }
    } catch (error) {
      console.error("Error sending invitations:", error);
      showNotification("Failed to send invitations", "error");
    } finally {
      inviteModalBtn.disabled = false;
      inviteModalBtn.innerHTML = originalContent;
    }
  }

  // Open modal
  inviteBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    // Check if room is full
    if (currentRoom && currentRoom.isFull) {
      showNotification("Room is full, cannot invite more players", "warning");
      return;
    }

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    // Reset selections
    selectedFriends.clear();
    updateInviteButton();

    // Load friends
    await loadAvailableFriends();

    friendSearch.focus();
  });

  // Search functionality
  friendSearch.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const friendItems = document.querySelectorAll(".friend-item");

    let visibleCount = 0;
    friendItems.forEach((item) => {
      const friendName = item.dataset.friendName;
      const isVisible = friendName.includes(searchTerm);
      item.style.display = isVisible ? "flex" : "none";
      if (isVisible) visibleCount++;
    });

    // Show no results message if needed
    if (visibleCount === 0 && friendItems.length > 0) {
      let noResults = document.querySelector(".no-search-results");
      if (!noResults) {
        noResults = document.createElement("div");
        noResults.className = "no-search-results";
        noResults.innerHTML = `
          <i class="fas fa-search"></i>
          <p>No friends found matching "${e.target.value}"</p>
        `;
        document.getElementById("friendsList").appendChild(noResults);
      }
    } else {
      const noResults = document.querySelector(".no-search-results");
      if (noResults) noResults.remove();
    }
  });

  // Close modal function
  function closeModal() {
    modal.style.display = "none";
    document.body.style.overflow = "";
    selectedFriends.clear();
    updateInviteButton();
    friendSearch.value = "";
    // Remove search no results if exists
    const noResults = document.querySelector(".no-search-results");
    if (noResults) noResults.remove();
  }

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);

  // Close on Escape key
  if (!listenersAttached) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") {
        closeModal();
      }
    });
    listenersAttached = true;
  }

  inviteModalBtn.addEventListener("click", async () => {
    await sendInvitations();
  });
}

function sendMessage(chatMessages, chatInput) {
  const message = chatInput.value.trim();
  if (!message || !currentRoom) return;

  if (message.length > 500) {
    showNotification("Message too long (max 500 characters)", "error");
    return false;
  }

  // Send via socket instead of local display
  if (window.socketManager && window.socketManager.connected) {
    window.socketManager.emit("chat:sendMessage", {
      roomId: currentRoom.roomId,
      message: message,
      type: "text",
    });

    chatInput.value = "";
    const sendBtn = document.getElementById("sendBtn");
    if (sendBtn) sendBtn.classList.remove("active");
  } else {
    showNotification("Connection lost. Please refresh the page.", "error");
  }
}

function initializeChatSocket() {
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const chatMessages = document.getElementById("chatMessages");
  let typingTimeout;

  if (window.socketManager) {
    window.socketManager.on("chat:newMessage", (message) => {
      displayChatMessage(message);
    });

    // window.socketManager.on("chat:userTyping", (data) => {
    //   handleTypingIndicator(data);
    // });

    window.socketManager.on("chat:messageSent", (data) => {
      if (data.success) {
        console.log("Message sent successfully");
      }
    });

    window.socketManager.on("chat:error", (error) => {
      showNotification(error.message, "error");
    });

    window.socketManager.on("chat:history", (data) => {
      displayChatHistory(data.messages);
    });
  }

  function displayChatMessage(data) {
    const chatMessages = document.getElementById("chatMessages");
    const messageEl = document.createElement("div");
    const isOwnMessage = data.userId === currentUserId;

    messageEl.className = `chat-message ${isOwnMessage ? "own" : ""} ${
      data.type || "text"
    }`;

    const time = new Date(data.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (data.type === "system") {
      messageEl.innerHTML = `
        <div class="system-message">
          <i class="fas fa-info-circle"></i>
          <span>${data.message}</span>
          <span class="message-time">${time}</span>
        </div>
      `;
    } else {
      messageEl.innerHTML = `
        <div class="message-sender">
          ${isOwnMessage ? "You" : data.username}
          <span class="message-time">${time}</span>
        </div>
        <div class="message-text ${isOwnMessage ? "own-message" : ""}"></div>
      `;
      messageEl.querySelector(".message-text").textContent = data.message;
    }

    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function loadChatHistory() {
    if (!currentRoom || !window.socketManager) return;

    window.socketManager.emit("chat:loadHistory", {
      roomId: currentRoom.roomId,
      limit: 50,
    });
  }

  function displayChatHistory(messages) {
    const chatMessages = document.getElementById("chatMessages");

    chatMessages.innerHTML = "";
    messages.forEach((message) => {
      displayChatMessage(message);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  /*
  function handleTypingIndicator(data) {
    console.log(
      `${data.username} is ${data.isTyping ? "typing" : "stopped typing"}`
    );
  }
  */
  loadChatHistory();
}

function setupRoomEventListeners() {
  const startBtn = document.querySelector(".start-game-btn");
  startBtn.addEventListener("click", () => {
    alert("Starting game...");
  });

  document.getElementById("copyCode").addEventListener("click", () => {
    copyRoomCode();
  });

  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const chatMessages = document.getElementById("chatMessages");
  let typingTimeout;

  chatInput.addEventListener("input", () => {
    const hasText = chatInput.value.trim().length > 0;
    sendBtn.classList.toggle("active", hasText);

    /* Emit typing status
    if (window.socketManager && currentRoom) {
      window.socketManager.emit("chat:typing", {
        roomId: currentRoom.roomId,
        isTyping: hasText,
      });

      // Clear previous timeout
      clearTimeout(typingTimeout);

      if (hasText) {
        typingTimeout = setTimeout(() => {
          window.socketManager.emit("chat:typing", {
            roomId: currentRoom.roomId,
            isTyping: false,
          });
        }, 2000);
      }
    }
    */
  });

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage(chatMessages, chatInput);
  });

  sendBtn.addEventListener("click", () => {
    sendMessage(chatMessages, chatInput);
  });
}

function refreshAvailableFriends() {
  const modal = document.getElementById("inviteModal");
  if (modal && modal.style.display === "flex") {
    // If modal is open, reload friends
    loadAvailableFriends();
  }
}

async function fetchRoomDetails() {
  const roomIdPath = window.location.pathname.split("/").filter(Boolean);
  const roomId = roomIdPath[roomIdPath.length - 1];

  try {
    const [roomRes, meRes] = await Promise.all([
      fetch(`/api/room/${roomId}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }),
      fetch("/auth/me", { credentials: "include" }),
    ]);

    // Handle specific error cases
    if (roomRes.status === 404) {
      throw new Error("Room not found");
    }

    if (roomRes.status === 403) {
      throw new Error("Access denied to this room");
    }

    if (!roomRes.ok || !meRes.ok) {
      throw new Error("Auth or room fetch failed");
    }

    const [roomData, meData] = await Promise.all([
      roomRes.json(),
      meRes.json(),
    ]);
    currentUserId = meData.user.id;

    if (roomData.success) {
      currentRoom = roomData.room;
      roomCode = roomData.room.roomCode;

      sessionStorage.setItem(
        "currentRoom",
        JSON.stringify({
          roomId: roomData.room.roomId,
          roomCode: roomData.room.roomCode,
        })
      );
      updateRoomUI(roomData.room);
    } else {
      throw new Error(roomData.message || "Failed to load room");
    }
  } catch (error) {
    console.error("Error fetching room:", error);
    // Handle different error types with specific messages
    if (error.message.includes("Room not found")) {
      showNotification("This room no longer exists", "error");
    } else if (error.message.includes("Access denied")) {
      showNotification("You don't have access to this room", "error");
    } else {
      showNotification("Failed to load room details", "error");
    }

    // Clear any stored room data
    sessionStorage.removeItem("currentRoom");

    setTimeout(() => {
      window.location.href = "/lobby";
    }, 1000);
  }
}

// Validate if user should be in this room
async function validateRoomAccess() {
  if (!currentRoom || !currentUserId) return false;

  const userInRoom = currentRoom.players.some(
    (player) => player.user._id === currentUserId
  );

  if (!userInRoom && currentRoom.status !== "waiting") {
    showNotification("You don't have access to this room", "error");
    setTimeout(() => {
      window.location.href = "/lobby";
    }, 1000);
    return false;
  }

  return true;
}

function updateRoomUI(room) {
  document.querySelector(".room-code-text").textContent = room.roomCode;
  document.querySelector(".room-info").textContent = `Code: ${room.roomCode}`;

  document.querySelector(".room-title").textContent = room.roomName;

  const settingsText = `${room.currentPlayers}/${room.settings.maxPlayers} players • ${room.settings.wordLength} letters • ${room.settings.maxTries} tries`;
  document.querySelector(".game-room-section p").textContent = settingsText;

  document.querySelector(
    ".game-room-section h3"
  ).textContent = `Players (${room.currentPlayers}/${room.settings.maxPlayers})`;

  updatePlayerCards(room.players, room.settings.maxPlayers);

  updateStartButton(room);
}

function updatePlayerCards(players, maxPlayers) {
  const playersGrid = document.querySelector(".players-grid");
  playersGrid.innerHTML = ""; // Clear existing cards

  // Add cards for existing players
  players.forEach((player, index) => {
    const isCurrentUser = player.user._id === currentUserId;
    const isHost = player.isHost;

    const playerCard = document.createElement("div");
    playerCard.className = `player-card ${
      isCurrentUser ? "current-player" : "joined"
    }`;

    playerCard.innerHTML = `
      ${
        isHost
          ? '<div class="crown-icon"><i class="fas fa-crown"></i></div>'
          : ""
      }
      <div class="player-card-avatar">${player.user.username
        .charAt(0)
        .toUpperCase()}</div>
      <div class="player-details">
        <h3>${isCurrentUser ? "You" : player.user.username}</h3>
        <p class="player-join-time">Joined ${formatTime(player.joinedAt)}</p>
      </div>
      <div class="player-status ${
        player.isReady ? "status-ready" : "status-joined"
      }">
        ${player.isReady ? "Ready" : "Joined"}
      </div>
    `;

    playersGrid.appendChild(playerCard);
  });

  // Add empty slots
  const emptySlots = maxPlayers - players.length;
  for (let i = 0; i < emptySlots; i++) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "player-card waiting";
    emptyCard.innerHTML = `
      <div class="player-card-avatar">
        <i class="fas fa-user-plus"></i>
      </div>
      <div class="player-details">
        <h3 class="waiting-text">Waiting for player...</h3>
      </div>
    `;
    playersGrid.appendChild(emptyCard);
  }
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateStartButton(room) {
  const startBtn = document.querySelector(".start-game-btn");
  const startMessage = document.querySelector(".start-message");

  // Only host can start the game
  if (!room.isHost) {
    startBtn.style.display = "none";
    startMessage.textContent = "Waiting for host to start the game...";
    return;
  }

  startBtn.style.display = "block";

  // Need at least 2 players to start
  if (room.currentPlayers < 2) {
    // startBtn.disabled = true;
    startMessage.textContent = "Need at least 2 players to start";
  } else {
    startBtn.disabled = false;
    startMessage.textContent =
      "Ready to start! Players can join during the game.";
  }
}

let roomInitialized = false;
function initializeRoom() {
  if (roomInitialized) return;
  roomInitialized = true;
  setupRoomEventListeners();
  initInviteModal();
  initLeaveModal();
  initSettingsModal();
  fetchRoomDetails().then(() => {
    refreshAvailableFriends();
    validateRoomAccess();
    setupRoomSocketHandlers();
    initializeChatSocket();
  });
}

window.roomUtils = {
  initializeRoom,
  fetchRoomDetails,
  updateRoomUI,
  validateRoomAccess,
  initLeaveModal,
  initInviteModal,
  refreshAvailableFriends,
  leaveRoom,
  copyRoomCode,
  sendMessage,
  getCurrentRoom: () => currentRoom,
  getRoomCode: () => roomCode,
  getCurrentUserId: () => currentUserId,
  handlePlayerLeft,
  handlePlayerJoined,
  handleSettingsUpdate,
  refresh: async () => {
    await fetchRoomDetails();
    refreshAvailableFriends();
  },
};
