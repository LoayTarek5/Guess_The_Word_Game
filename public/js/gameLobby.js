// Game Settings Modal Functions

// Global variables
let currentTries = 6;
let currentPlayers = 2;
let modal = null;
let modalElements = {};

// Initialize modal elements and bind events
function initGameSettingsModal() {
  modal = document.getElementById("gameSettingsModal");

  // Cache DOM elements
  modalElements = {
    closeBtn: document.getElementById("closeModal"),
    cancelBtn: document.getElementById("cancelBtn"),
    createBtn: document.getElementById("createGameBtn"),
    wordLengthSelect: document.getElementById("wordLengthSelect"),
    triesCount: document.getElementById("triesCount"),
    decreaseBtn: document.getElementById("decreaseTries"),
    increaseBtn: document.getElementById("increaseTries"),
    playerInputs: document.getElementById("playerInputs"),
    previewLetters: document.getElementById("previewLetters"),
    previewTries: document.getElementById("previewTries"),
    previewPlayers: document.getElementById("previewPlayers"),
    difficultyBadge: document.getElementById("difficultyBadge"),
  };

  bindModalEvents();
}

// Bind all modal events
function bindModalEvents() {
  // Modal close events
  modalElements.closeBtn.addEventListener("click", closeGameSettingsModal);
  modalElements.cancelBtn.addEventListener("click", closeGameSettingsModal);
  modal.addEventListener("click", handleModalOverlayClick);

  // Form events
  modalElements.wordLengthSelect.addEventListener("change", updatePreview);
  modalElements.decreaseBtn.addEventListener("click", decreaseTries);
  modalElements.increaseBtn.addEventListener("click", increaseTries);

  // Group size tabs
  const sizeTabs = document.querySelectorAll(".size-tab");
  sizeTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      changeGroupSize(this);
    });
  });

  // Preset buttons
  const presetBtns = document.querySelectorAll(".preset-btn");
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      selectPreset(this);
    });
  });

  // Create game button
  modalElements.createBtn.addEventListener("click", createGame);

  // ESC key to close
  document.addEventListener("keydown", handleEscapeKey);

  // Auto-bind to Create Room buttons
  bindCreateRoomButtons();
}

// Open modal
function openGameSettingsModal() {
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

// Close modal
function closeGameSettingsModal() {
  modal.classList.remove("active");
  document.body.style.overflow = "";
}

// Handle modal overlay click
function handleModalOverlayClick(e) {
  if (e.target === modal) {
    closeGameSettingsModal();
  }
}

// Handle ESC key
function handleEscapeKey(e) {
  if (e.key === "Escape" && modal.classList.contains("active")) {
    closeGameSettingsModal();
  }
}

// Decrease tries count
function decreaseTries() {
  if (currentTries > 3) {
    currentTries--;
    modalElements.triesCount.textContent = currentTries;
    updatePreview();
    updateTriesButtonStates();
  }
}

// Increase tries count
function increaseTries() {
  if (currentTries < 10) {
    currentTries++;
    modalElements.triesCount.textContent = currentTries;
    updatePreview();
    updateTriesButtonStates();
  }
}

// Update tries button states
function updateTriesButtonStates() {
  modalElements.decreaseBtn.disabled = currentTries <= 3;
  modalElements.increaseBtn.disabled = currentTries >= 10;
}

// Change group size
function changeGroupSize(selectedTab) {
  // Update active tab
  const allTabs = document.querySelectorAll(".size-tab");
  allTabs.forEach((tab) => tab.classList.remove("active"));
  selectedTab.classList.add("active");

  // Get selected size
  const size = parseInt(selectedTab.dataset.size);
  currentPlayers = size;

  // Show/hide player inputs
  const inputs = modalElements.playerInputs.querySelectorAll(".player-input");
  inputs.forEach(function (input, index) {
    if (index < size) {
      input.style.display = "block";
    } else {
      input.style.display = "none";
    }
  });

  updatePreview();
}

// Select preset configuration
function selectPreset(selectedBtn) {
  // Update active preset
  const allPresets = document.querySelectorAll(".preset-btn");
  allPresets.forEach((btn) => btn.classList.remove("active"));
  selectedBtn.classList.add("active");

  // Apply preset settings
  const preset = selectedBtn.dataset.preset;
  applyPresetSettings(preset);

  modalElements.triesCount.textContent = currentTries;
  updatePreview();
  updateTriesButtonStates();
}

// Apply preset settings based on type
function applyPresetSettings(preset) {
  switch (preset) {
    case "easy":
      modalElements.wordLengthSelect.value = "4";
      currentTries = 8;
      break;
    case "classic":
      modalElements.wordLengthSelect.value = "5";
      currentTries = 6;
      break;
    case "challenge":
      modalElements.wordLengthSelect.value = "6";
      currentTries = 5;
      break;
  }
}

// Update difficulty preview
function updatePreview() {
  const letters = modalElements.wordLengthSelect.value;
  const tries = currentTries;
  const players = currentPlayers;

  modalElements.previewLetters.textContent = letters;
  modalElements.previewTries.textContent = tries;
  modalElements.previewPlayers.textContent = players;

  updateDifficultyBadge(letters, tries);
}

// Update difficulty badge
function updateDifficultyBadge(letters, tries) {
  let difficulty = getDifficultyLevel(letters, tries);
  modalElements.difficultyBadge.textContent = difficulty;

  // Update badge styling
  const badgeColors = getDifficultyColors(difficulty);
  modalElements.difficultyBadge.style.backgroundColor = badgeColors.bg;
  modalElements.difficultyBadge.style.color = badgeColors.text;
}

// Determine difficulty level
function getDifficultyLevel(letters, tries) {
  if (letters <= 4 && tries >= 7) return "Easy";
  if (letters >= 6 && tries <= 5) return "Hard";
  if (letters >= 7) return "Expert";
  return "Normal";
}

// Get difficulty badge colors
function getDifficultyColors(difficulty) {
  switch (difficulty) {
    case "Easy":
      return { bg: "#d1fae5", text: "#059669" };
    case "Hard":
    case "Expert":
      return { bg: "#fee2e2", text: "#dc2626" };
    default:
      return { bg: "#dbeafe", text: "#1d4ed8" };
  }
}

// Create game with current settings
function createGame() {
  const gameSettings = getGameSettings();

  // Log settings for debugging
  console.log("Creating game with settings:", gameSettings);

  // Here you would typically send this data to your server
  // For now, show alert and close modal
  showGameCreatedAlert(gameSettings);
  closeGameSettingsModal();
}

// Get current game settings
function getGameSettings() {
  const playerInputs =
    modalElements.playerInputs.querySelectorAll(".player-input");
  const players = [];

  for (let i = 0; i < currentPlayers; i++) {
    const input = playerInputs[i];
    players.push(input.value || `Player ${i + 1}`);
  }

  return {
    wordLength: parseInt(modalElements.wordLengthSelect.value),
    maxTries: currentTries,
    playerCount: currentPlayers,
    players: players,
  };
}

// Show game created confirmation
function showGameCreatedAlert(settings) {
  const message = `Game created!\nWord Length: ${
    settings.wordLength
  }\nMax Tries: ${settings.maxTries}\nPlayers: ${settings.players.join(", ")}`;
  alert(message);
}

// Auto-bind to existing Create Room buttons
function bindCreateRoomButtons() {
  const createRoomBtns = document.querySelectorAll(".btn-outline");
  createRoomBtns.forEach(function (btn) {
    if (btn.textContent.includes("Create Room")) {
      btn.addEventListener("click", openGameSettingsModal);
    }
  });
}

// Initialize when DOM is loaded
function initializeGameLobby() {
  initGameSettingsModal();
}

// Expose function globally for external use
// Export all functions
window.gameLobbyUtils = {
  initializeGameLobby,
  initGameSettingsModal,
  bindModalEvents,
  openGameSettingsModal,
  closeGameSettingsModal,
  handleModalOverlayClick,
  handleEscapeKey,
  decreaseTries,
  increaseTries,
  updateTriesButtonStates,
  changeGroupSize,
  selectPreset,
  applyPresetSettings,
  updatePreview,
  updateDifficultyBadge,
  getDifficultyLevel,
  getDifficultyColors,
  createGame,
  getGameSettings,
  showGameCreatedAlert,
  bindCreateRoomButtons,
};
