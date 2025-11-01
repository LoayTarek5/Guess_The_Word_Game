let currentBrowsePage = 1;
const roomsPerPage = 10;

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

      // Load rooms when browse tab is activated
      if (targetTab === "browse") {
        loadRooms(currentPage);
      }
    });
  });
}

async function loadRooms(page = 1) {
  try {
    const response = await fetch(
      `/lobby/browse?page=${page}&limit=${roomsPerPage}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch rooms");
    }

    const data = await response.json();

    if (data.success) {
      currentPage = page;
      if (data.rooms.length === 0) {
        displayEmptyState();
      } else {
        displayRooms(data.rooms);
        displayPagination(data.pagination);
      }
    }
  } catch (error) {
    console.error("Error loading rooms:", error);
    showNotification("Failed to load rooms. Please try again.", "error");
    displayEmptyState();
  }
}

function displayRooms(rooms) {
  const roomList = document.querySelector(".room-list");
  if (!roomList || roomList.length === 0) {
    displayEmptyState();
    return;
  }
  roomList.innerHTML = rooms
    .map((room) => {
      const difficultyClass = `badge-${room.settings.difficulty.toLowerCase()}`;
      const statusClass = room.isFull ? "status-full" : "status-waiting";
      const statusText = room.isFull ? "Full" : "Waiting";
      const joinBtnDisabled = room.isFull ? "disabled" : "";
      const avatarLetter =
        room.creator.avatar.length === 1
          ? room.creator.avatar
          : room.creator.username.charAt(0).toUpperCase();

      return `
        <div class="room-item" data-room-id="${room.roomId}">
          <div class="room-info">
            <div class="room-avatar">${avatarLetter}</div>
            <div class="room-details">
              <div class="room-name">${room.roomName}</div>
              <div class="room-meta">Hosted by ${room.creator.username} • ${room.timeAgo}</div>
            </div>
          </div>
          <div class="room-badges">
            <div class="difficulty-badge ${difficultyClass}">${room.settings.difficulty}</div>
            <div class="room-code">${room.roomCode}</div>
            <div class="game-stats">
              <span>${room.settings.wordLength}L</span>
              <span>${room.settings.maxTries}T</span>
            </div>
          </div>
          <div class="room-actions">
            <div class="player-count">
              <i class="fas fa-users"></i>
              ${room.currentPlayers}/${room.maxPlayers}
            </div>
            <div class="status-indicator ${statusClass}">${statusText}</div>
            <button class="join-btn" data-room-code="${room.roomCode}" ${joinBtnDisabled}>
              Join Room
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function displayEmptyState() {
  const roomList = document.querySelector(".room-list");
  roomList.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-inbox" style="font-size: 48px; color: #94a3b8; margin-bottom: 16px;"></i>
      <p style="color: #64748b; font-size: 16px; margin: 0;">No active rooms available</p>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 8px;">Create a new room to get started!</p>
    </div>
  `;
}

function displayPagination(pagination) {
  const browseTab = document.getElementById("browse-tab");

  // Remove existing pagination if any
  const existingPagination = browseTab.querySelector(".friend-pagination");
  if (existingPagination) {
    existingPagination.remove();
  }

  // Only show pagination if there are rooms and multiple pages
  if (pagination.totalRooms === 0 || pagination.totalPages <= 1) {
    return;
  }

  const paginationHTML = createPaginationHTML(pagination);
  browseTab.insertAdjacentHTML("beforeend", paginationHTML);

  // Attach pagination event listeners
  attachPaginationListeners();
}

// Attach event listeners to pagination buttons
function attachPaginationListeners() {
  const paginationButtons = document.querySelectorAll(
    ".pagination button[data-page]"
  );

  paginationButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const page = parseInt(e.currentTarget.dataset.page);
      if (page && page !== currentPage) {
        loadRooms(page);
        // Scroll to top of room list
        document
          .querySelector(".room-list")
          .scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

// Attach event listeners to join buttons
function attachJoinButtonListeners() {
  document.querySelectorAll(".join-btn").forEach((btn) => {
    if (!btn.disabled) {
      btn.addEventListener("click", (e) => {
        const roomCode = e.target.dataset.roomCode;
        if (roomCode) {
          joinRoomByRoomCode(roomCode);
        }
      });
    }
  });
}

function createPaginationHTML(pagination) {
  if (pagination.totalPages <= 1) {
    return "";
  }

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalGames,
    hasPrevPage,
    hasNextPage,
  } = pagination;

  // Generate page numbers with ellipsis logic
  const getPageElements = () => {
    const elements = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total pages <= maxVisible
      for (let i = 1; i <= totalPages; i++) {
        elements.push({ type: "page", number: i });
      }
    } else {
      // Always show first page
      elements.push({ type: "page", number: 1 });

      let start, end;

      if (currentPage <= 3) {
        // Near beginning: 1 2 3 4 ... last
        start = 2;
        end = 4;
        if (end < totalPages - 1) {
          elements.push(
            ...Array.from({ length: end - start + 1 }, (_, i) => ({
              type: "page",
              number: start + i,
            }))
          );
          elements.push({ type: "ellipsis", id: "end" });
        } else {
          elements.push(
            ...Array.from({ length: totalPages - 1 }, (_, i) => ({
              type: "page",
              number: i + 2,
            }))
          );
        }
      } else if (currentPage >= totalPages - 2) {
        // Near end: 1 ... last-3 last-2 last-1 last
        if (totalPages > 4) {
          elements.push({ type: "ellipsis", id: "start" });
          start = totalPages - 3;
          elements.push(
            ...Array.from({ length: 3 }, (_, i) => ({
              type: "page",
              number: start + i,
            }))
          );
        } else {
          elements.push(
            ...Array.from({ length: totalPages - 2 }, (_, i) => ({
              type: "page",
              number: i + 2,
            }))
          );
        }
      } else {
        // In middle: 1 ... current-1 current current+1 ... last
        elements.push({ type: "ellipsis", id: "start" });
        elements.push({ type: "page", number: currentPage - 1 });
        elements.push({ type: "page", number: currentPage });
        elements.push({ type: "page", number: currentPage + 1 });
        elements.push({ type: "ellipsis", id: "end" });
      }

      // Always show last page (if not already included)
      const lastElem = elements[elements.length - 1];
      if (
        !(
          lastElem &&
          lastElem.type === "page" &&
          lastElem.number === totalPages
        )
      ) {
        elements.push({ type: "page", number: totalPages });
      }
    }

    return elements;
  };

  const pageElements = getPageElements();

  return `
    <nav class="friend-pagination">
      <div class="pagination-info">
        <p>Showing ${startIndex} to ${endIndex} of ${totalGames} Matches</p>
      </div>
      <ul class="pagination">
        <li class="page-item">
          <button class="page-slide back ${!hasPrevPage ? "disable" : ""}" 
                  data-page="${currentPage - 1}" 
                  ${!hasPrevPage ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-left"></i>
            <span>Back</span>
          </button>
        </li>
        ${pageElements
          .map((element) => {
            if (element.type === "page") {
              return `
              <li class="page-item">
                <button class="page-curr ${
                  element.number === currentPage ? "active" : ""
                }" 
                        data-page="${element.number}">
                  ${element.number}
                </button>
              </li>
            `;
            } else {
              // Ellipsis button: compute target page to jump to
              const targetPage =
                element.id === "start"
                  ? Math.max(2, currentPage - 2)
                  : Math.min(totalPages - 1, currentPage + 2);

              return `
              <li class="page-item">
                <button class="page-ellipsis" data-page="${targetPage}" title="Jump to page ${targetPage}">
                  <i class="fa-solid fa-ellipsis"></i>
                </button>
              </li>
            `;
            }
          })
          .join("")}
        <li class="page-item">
          <button class="page-slide next ${!hasNextPage ? "disable" : ""}" 
                  data-page="${currentPage + 1}" 
                  ${!hasNextPage ? "disabled" : ""}>
            <span>Next</span>
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  `;
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
      sessionStorage.setItem(
        "currentRoom",
        JSON.stringify({
          roomId: data.roomId,
          roomCode: roomCode,
        })
      );

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
  document.querySelector(".room-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // Only handle pagination buttons
    if (btn.classList.contains("join-btn")) {
      e.preventDefault();

      if (btn.disabled) return;

      btn.addEventListener("click", (e) => {
        const roomItem = e.target.closest(".room-item");
        const roomCodeElement = roomItem.querySelector(".room-code");
        const roomCode = roomCodeElement.textContent.trim();
        console.log("JOINNNNN");
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
    isPrivate: document.getElementById("isPrivate").checked,
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
  console.log();
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
  attachJoinButtonListeners();
  const browseTab = document.querySelector('.tab-button[data-tab="browse"]');
  if (browseTab && browseTab.classList.contains("active")) {
    loadRooms(1);
  }
}

window.gameLobbyUtils = {
  initializeGameLobby,
  initTabs,
  updateDifficultyPreview,
  initJoinRoom,
  setEventListener,
};
