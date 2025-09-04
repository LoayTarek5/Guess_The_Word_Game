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
  let difficulty = "Classic";

  if (wordLength <= 4 && maxTries >= 7) {
    difficulty = "Easy";
  } else if (wordLength >= 6 && maxTries <= 5) {
    difficulty = "Hard";
  } else if (wordLength >= 7) {
    difficulty = "Expert";
  }

  difficultyBadge.textContent = difficulty;
}

// Join room code validation
function initJoinRoom() {
  const codeInput = document.querySelector(".code-input");
  const joinBtn = document.getElementById("joinRoomBtn");

  codeInput.addEventListener("input", (e) => {
    const value = e.target.value.toUpperCase();
    e.target.value = value;

    if (value.length === 6) {
      joinBtn.classList.add("active");
      joinBtn.style.cursor = "pointer";
    } else {
      joinBtn.classList.remove("active");
      joinBtn.style.cursor = "not-allowed";
    }
  });

  joinBtn.addEventListener("click", () => {
    if (joinBtn.classList.contains("active")) {
      const code = codeInput.value;
      alert(`Joining room with code: ${code}`);
    }
  });
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
  document.querySelector(".create-btn").addEventListener("click", () => {
    window.location.href = "/room";
    alert("Room created successfully!");
  });

  // Join room buttons in browse tab
  document.querySelectorAll(".join-btn").forEach((btn) => {
    if (!btn.disabled) {
      btn.addEventListener("click", () => {
        alert("Joining room...");
      });
    }
  });
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
