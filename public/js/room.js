// Room code copy functionality
function copyRoomCode() {
  navigator.clipboard.writeText("ABCDEF").then(() => {
    // Visual feedback
    const copyBtn = document.querySelector(".copy-btn");
    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      copyBtn.innerHTML = originalHtml;
    }, 2000);
  });
}

function sendMessage(chatMessages) {
  const message = chatInput.value.trim();
  if (message) {
    const messageEl = document.createElement("div");
    messageEl.className = "chat-message own";
    messageEl.innerHTML = `
                        <div class="message-sender">
                            You
                            <span class="message-time">${new Date().toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}</span>
                        </div>
                        <div class="message-text own-message">${message}</div>
                    `;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.value = "";
  }
}

function initInviteModal() {
  const inviteBtn = document.querySelector(".invite-btn");
  const modal = document.getElementById("inviteModal");
  const closeBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const modalOverlay = document.querySelector(".modal-overlay");
  const inviteModalBtn = document.getElementById("inviteBtn");
  const friendSearch = document.getElementById("friendSearch");
  const friendItems = document.querySelectorAll(".friend-item");
  const inviteFriendBtns = document.querySelectorAll(".invite-friend-btn");

  let selectedFriends = new Set();

  // Open modal
  inviteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    friendSearch.focus();
  });

  // Close modal functions
  function closeModal() {
    modal.style.display = "none";
    document.body.style.overflow = "";
    selectedFriends.clear();
    updateInviteButton();
    resetFriendButtons();
    friendSearch.value = "";
    filterFriends("");
  }

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "flex") {
      closeModal();
    }
  });

  // Friend selection
  inviteFriendBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const friendName = btn.dataset.friend;

      if (selectedFriends.has(friendName)) {
        selectedFriends.delete(friendName);
        btn.classList.remove("selected");
        btn.innerHTML = '<i class="fas fa-plus"></i>';
      } else {
        selectedFriends.add(friendName);
        btn.classList.add("selected");
        btn.innerHTML = '<i class="fas fa-check"></i>';
      }

      updateInviteButton();
    });
  });

  // Update invite button state
  function updateInviteButton() {
    if (selectedFriends.size > 0) {
      inviteModalBtn.disabled = false;
      inviteModalBtn.textContent = `Invite (${selectedFriends.size})`;
    } else {
      inviteModalBtn.disabled = true;
      inviteModalBtn.textContent = "Invite";
    }
  }

  // Reset friend buttons
  function resetFriendButtons() {
    inviteFriendBtns.forEach((btn) => {
      btn.classList.remove("selected");
      btn.innerHTML = '<i class="fas fa-plus"></i>';
    });
  }

  // Search functionality
  friendSearch.addEventListener("input", (e) => {
    filterFriends(e.target.value.toLowerCase());
  });

  function filterFriends(searchTerm) {
    friendItems.forEach((item) => {
      const friendName = item
        .querySelector(".friend-name")
        .textContent.toLowerCase();
      if (friendName.includes(searchTerm)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  }

  // Send invites
  inviteModalBtn.addEventListener("click", () => {
    if (selectedFriends.size > 0) {
      const friendsArray = Array.from(selectedFriends);
      console.log("Inviting friends:", friendsArray);

      // Here you would typically send the invites to your backend
      alert(`Invites sent to: ${friendsArray.join(", ")}`);

      closeModal();
    }
  });
}

function setupRoomEventListeners() {
  document.querySelector(".settings-btn").addEventListener("click", () => {
    alert("Opening game settings...");
  });

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
  chatInput.addEventListener("input", () => {
    const hasText = chatInput.value.trim().length > 0;
    sendBtn.classList.toggle("active", hasText);
  });
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage(chatMessages);
    }
  });
  sendBtn.addEventListener("click", () => {
    sendMessage(chatMessages);
    const hasText = chatInput.value.trim().length > 0;
    sendBtn.classList.toggle("active", hasText);
  });
}

function initializeRoom() {
  setupRoomEventListeners();
  initInviteModal();
}

window.roomUtils = {
  initializeRoom,
};
