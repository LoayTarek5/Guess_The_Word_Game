// Tab functionality
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;

      // Remove active classes
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanes.forEach((pane) => pane.classList.remove("active"));

      // Add active class to clicked button
      button.classList.add("active");

      // Show corresponding tab pane
      document.getElementById(`${targetTab}-tab`).classList.add("active");
    });
  });
}

// Update difficulty preview
function updateDifficultyPreview() {
  const wordLength = parseInt(document.getElementById("wordLength").value);
  const maxTries = parseInt(document.getElementById("maxTries").value);
  const maxPlayers = parseInt(document.getElementById("maxPlayers").value);

  document.getElementById("previewLetters").textContent = wordLength;
  document.getElementById("previewTries").textContent = maxTries;
  document.getElementById("previewPlayers").textContent = maxPlayers;

  // Update difficulty badge
  const difficultyBadge = document.getElementById("difficultyBadge");
  const difficulty = calculateDifficulty(wordLength, maxTries);
  difficultyBadge.textContent = difficulty;

  difficultyBadge.className = "difficulty-badge-corner";
  difficultyBadge.classList.add(`difficulty-${difficulty.toLowerCase()}`);
}

function calculateDifficulty(wordLength, maxTries) {
  const difficultyScore = wordLength * 2 + (9 - maxTries);

  if (difficultyScore <= 13) return "Easy";
  if (difficultyScore <= 15) return "Classic";
  if (difficultyScore <= 17) return "Hard";
  return "Expert";
}

// Join room code validation
function initJoinRoom() {
  const codeInput = document.querySelector(".code-input");
  const joinBtn = document.getElementById("joinRoomBtn");

  codeInput.addEventListener("input", (e) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    e.target.value = value;

    if (value.length === 6) {
      joinBtn.classList.add("active");
      joinBtn.style.cursor = "pointer";
    } else {
      joinBtn.classList.remove("active");
      joinBtn.style.cursor = "not-allowed";
    }
  });

  codeInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData("text");
    const cleanPaste = paste
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 6);
    codeInput.value = cleanPaste;

    // Trigger input event to update button state
    codeInput.dispatchEvent(new Event("input"));
  });

  // Handle Enter key press
  codeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && codeInput.value.length === 6) {
      joinRoomByCode();
    }
  });

  // Join button click handler
  joinBtn.addEventListener("click", () => {
    if (joinBtn.classList.contains("active") && !joinBtn.disabled) {
      joinRoomByCode();
    }
  });
}

async function joinRoomByCode() {
  const codeInput = document.querySelector(".code-input");
  const joinBtn = document.getElementById("joinRoomBtn");
  const roomCode = codeInput.value.trim();

  if (!roomCode || roomCode.length !== 6) {
    showNotification("Please enter a valid 6-character room code", "error");
    return;
  }

  // Show loading state
  const originalContent = joinBtn.innerHTML;
  joinBtn.disabled = true;
  joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';

  try {
    const response = await fetch(`/api/room/join/${roomCode}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (response.ok) {
      sessionStorage.setItem(
        "currentRoom",
        JSON.stringify({
          roomId: data.roomId,
          roomCode: roomCode,
        })
      );
      if (data.alreadyJoined) {
        showNotification("You're already in this room!", "info");
      } else {
        showNotification("Successfully joined the room!", "success");
      }

      // Redirect to room page
      setTimeout(() => {
        window.location.href = `/room/${data.roomId}`;
      }, 500);
    } else {
      // Handle different error cases
      switch (response.status) {
        case 404:
          showNotification("Room not found or game already started", "error");
          break;
        case 400:
          if (data.message === "Room is full") {
            showNotification("This room is full", "error");
          } else if (data.message === "You are already in this room") {
            showNotification("You're already in this room", "info");
          } else {
            showNotification("Invalid room code format", "error");
          }
          break;
        case 403:
          showNotification("Access denied to this room", "error");
          break;
        default:
          showNotification(
            `Error: ${data.message || "Failed to join room"}`,
            "error"
          );
      }
    }
  } catch (error) {
    console.error("Error joining room:", error);
    showNotification(
      "Network error. Please check your connection and try again.",
      "error"
    );
  } finally {
    // Restore button state
    joinBtn.disabled = false;
    joinBtn.innerHTML = originalContent;

    // Re-check button state based on input
    const currentValue = codeInput.value;
    if (currentValue.length === 6) {
      joinBtn.classList.add("active");
      joinBtn.style.cursor = "pointer";
      joinBtn.disabled = false;
    } else {
      joinBtn.classList.remove("active");
      joinBtn.style.cursor = "not-allowed";
      joinBtn.disabled = true;
    }
  }
}

async function joinRoomByRoomCode(roomCode) {
  try {
    const response = await fetch(`/api/room/join/${roomCode}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok) {
      sessionStorage.setItem('currentRoom', JSON.stringify({
        roomId: data.roomId,
        roomCode: roomCode
      }));

      showNotification("Successfully joined the room!", "success");
      
      setTimeout(() => {
        window.location.href = `/room/${data.roomId}`;
      }, 500);
    } else {
      showNotification(`Failed to join room: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Error joining room:", error);
    showNotification("Failed to join room. Please try again.", "error");
  }
}

function setEventListener() {
  document
    .getElementById("wordLength")
    .addEventListener("change", updateDifficultyPreview);
  document
    .getElementById("maxTries")
    .addEventListener("change", updateDifficultyPreview);
  document
    .getElementById("maxPlayers")
    .addEventListener("change", updateDifficultyPreview);

  // Create room button
  document.querySelector(".create-btn").addEventListener("click", dataRoom);

  // Join room buttons in browse tab
  document.querySelectorAll(".join-btn").forEach((btn) => {
    if (!btn.disabled) {
      btn.addEventListener("click", (e) => {
        const roomItem = e.target.closest(".room-item");
        const roomCodeElement = roomItem.querySelector(".room-code");
        const roomCode = roomCodeElement.textContent.trim();

        joinRoomByRoomCode(roomCode);
      });
    }
  });
}

async function dataRoom() {
  const roomDetails = {
    roomName:
      document.querySelector("input[aria-label='room name']").value.trim() ||
      undefined,
    settings: {
      wordLength: parseInt(document.getElementById("wordLength").value),
      maxPlayers: parseInt(document.getElementById("maxPlayers").value),
      language: document.querySelector('select[aria-label="Language select"]')
        .value,
      maxTries: parseInt(document.getElementById("maxTries").value),
      difficulty: document
        .getElementById("difficultyBadge")
        .textContent.toLowerCase(),
    },
    createdAt: new Date().toISOString(),
  };

  const validation = validateRoomData(roomDetails);

  if (!validation.isValid) {
    showNotification(validation.error, "error");
    return;
  }

  // Show loading state
  const createBtn = document.querySelector(".create-btn");
  const originalContent = createBtn.innerHTML;
  createBtn.disabled = true;
  createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

  try {
    const response = await fetch("/api/room/create", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(roomDetails),
    });
    if (response.ok) {
      const data = await response.json();
      // Store room info for quick access
      sessionStorage.setItem(
        "currentRoom",
        JSON.stringify({
          roomId: data.roomId,
          roomCode: data.roomCode,
        })
      );

      showNotification("Room created successfully!", "success");

      setTimeout(() => {
        window.location.href = `/room/${data.roomId}`;
      }, 500);
    } else {
      const error = await response.json();
      showNotification(`Error creating room: ${error.message}`, "error");
    }
  } catch (error) {
    showNotification("Failed to create room. Please try again.", "error");
    console.error("Error creating room:", error);
  } finally {
    // Restore button state
    createBtn.disabled = false;
    createBtn.innerHTML = originalContent;
  }
}

function validateRoomData(data) {
  if (!data || !data.settings) {
    return {
      isValid: false,
      error: "Invalid room data",
    };
  }

  const { settings } = data;

  if (data.roomName) {
    if (data.roomName.length > 50) {
      return {
        isValid: false,
        error: "Room name must be less than 50 characters",
      };
    }
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

  if (![4, 5, 6, 7, 8].includes(settings.maxTries)) {
    return {
      isValid: false,
      error: "Invalid number of tries selected",
    };
  }

  const validDifficulties = ["easy", "classic", "hard", "expert"];
  if (!validDifficulties.includes(settings.difficulty)) {
    return {
      isValid: false,
      error: "Invalid difficulty level",
    };
  }

  return {
    isValid: true,
  };
}

// Initialize when DOM is loaded
function initializeGameLobby() {
  initTabs();
  updateDifficultyPreview();
  initJoinRoom();
  setEventListener();
}

window.gameLobbyUtils = {
  initializeGameLobby,
  initTabs,
  updateDifficultyPreview,
  initJoinRoom,
  setEventListener,
};
