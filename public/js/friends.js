async function addNewFriend() {
  const username = prompt("Enter username to add as friend:");
  if (!username || username.trim() === "") return;

  try {
    const response = await fetch("/api/friends/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username: username.trim() }),
    });
    const result = await response.json();
    if (result.success) {
      showNotification(result.message, "success");
    } else {
      showNotification(result.message, "error");
    }
  } catch (error) {
    console.error("Error sending friend request:", error);
    showNotification("Failed to send friend request", "error");
  }
}

async function removeFriend(userId, username) {
  if (
    !confirm(`Are you sure you want to remove ${username} from your friends?`)
  ) {
    return;
  }
  try {
    const response = await fetch(`/api/friends/remove/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      showNotification(result.message, "success");
      loadFriendsData();
    } else {
      showNotification(result.message, "error");
    }
  } catch (error) {
    console.error("Error removing friend:", error);
    showNotification("Failed to remove friend", "error");
  }
}

async function acceptFriend(userId, username) {
  try {
    const response = await fetch(`/api/friends/accept/${userId}`, {
      method: "POST",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      showNotification(`You are now friends with ${username}!`, "success");
      loadFriendsData();
      loadPendingRequests();
    } else {
      showNotification(result.message, "error");
    }
  } catch (error) {
    console.error("Error accepting friend request:", error);
    showNotification("Failed to accept friend request", "error");
  }
}

async function declineFriend(userId, username) {
  try {
    const response = await fetch(`/api/friends/decline/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      showNotification(`Friend request from ${username} declined`, "info");
      loadPendingRequests();
    } else {
      showNotification(result.message, "error");
    }
  } catch (error) {
    console.error("Error declining friend request:", error);
    showNotification("Failed to decline friend request", "error");
  }
}

async function cancelFriendRequest(requestId, toUsername) {
  if (!confirm(`Cancel friend request to ${toUsername}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/friends/cancel/${requestId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Friend request to ${toUsername} cancelled`, "info");
      loadPendingRequests();
    } else {
      showNotification(result.message, "error");
    }
  } catch (error) {
    console.error("Error cancelling friend request:", error);
    showNotification("Failed to cancel friend request", "error");
  }
}

async function loadPendingRequests() {
  try {
    const response = await fetch("/api/friends/requests", {
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();

      if (result.success) {
        displayPendingRequests(result.received, result.sent);
      }
    } else {
      console.error("Failed to load pending requests");
    }
  } catch (error) {
    console.error("Error loading pending requests:", error);
  }
}

function displayPendingRequests(receivedRequests, sentRequests) {
  // Create or update requests container
  let requestsContainer = document.querySelector(".requests-container");

  if (!requestsContainer) {
    // Create requests container and add it before friends section
    requestsContainer = document.createElement("div");
    requestsContainer.className = "requests-container";

    const friendsSection = document.querySelector(".friends-section");
    friendsSection.parentNode.insertBefore(requestsContainer, friendsSection);
  }

  // Build requests HTML WITHOUT inline handlers
  let requestsHTML = "";

  if (receivedRequests.length > 0) {
    requestsHTML += `
      <div class="requests-section">
        <h4>Friend Requests (${receivedRequests.length})</h4>
        <div class="requests-content">
          ${receivedRequests
            .map(
              (request) => `
            <div class="request-item received">
              <div class="request-info">
                <span class="request-avatar">
                  ${
                    request.from.avatar
                      ? `<img src="${request.from.avatar}" alt="${request.from.username}">`
                      : request.from.username.charAt(0).toUpperCase()
                  }
                </span>
                <div class="request-details">
                  <p class="request-name">${request.from.username}</p>
                  <span class="request-level">Level ${request.from.level}</span>
                </div>
              </div>
              <div class="request-actions">
                <button class="accept-btn" data-action="accept" data-request-id="${
                  request.id
                }" data-username="${request.from.username}">
                  <i class="fa-solid fa-check"></i>
                  Accept
                </button>
                <button class="decline-btn" data-action="decline" data-request-id="${
                  request.id
                }" data-username="${request.from.username}">
                  <i class="fa-solid fa-times"></i>
                  Decline
                </button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  if (sentRequests.length > 0) {
    requestsHTML += `
      <div class="sent-requests-section">
        <h4>Sent Requests (${sentRequests.length})</h4>
        <div class="requests-content">
          ${sentRequests
            .map(
              (request) => `
            <div class="request-item sent">
              <div class="request-info">
                <span class="request-avatar">
                  ${
                    request.to.avatar
                      ? `<img src="${request.to.avatar}" alt="${request.to.username}">`
                      : request.to.username.charAt(0).toUpperCase()
                  }
                </span>
                <div class="request-details">
                  <p class="request-name">${request.to.username}</p>
                  <span class="request-level">Level ${request.to.level}</span>
                </div>
              </div>
              <div class="request-actions">
                <button class="cancel-btn" data-action="cancel" data-request-id="${
                  request.id
                }" data-username="${request.to.username}">
                  <i class="fa-solid fa-times"></i>
                  Cancel
                </button>
                <span class="pending-status">Pending...</span>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  if (requestsHTML === "") {
    requestsContainer.style.display = "none";
  } else {
    requestsContainer.style.display = "block";
    requestsContainer.innerHTML = requestsHTML;
  }
}

async function loadFriendsData() {
  const friendsContainer = document.querySelector(".friend-content");

  try {
    const response = await fetch("/api/friends", {
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();

      if (result.success) {
        const friends = result.friends;
        // displayFriendsData(friends, friendsContainer);
        
        // Update friends count in stats (assuming you have these elements)
        const friendsOnlineElements = document.querySelectorAll(
          ".state-group .state-info p"
        );
        if (friendsOnlineElements.length >= 4) {
          friendsOnlineElements[3].textContent = result.count.online;
        }

        const friendsTotalSpan = document.querySelectorAll(
          ".state-group .state-info span"
        );
        if (friendsTotalSpan[3]) {
          friendsTotalSpan[3].textContent = `of ${result.count.total} friends`;
        }

        // Display friends
        if (friendsContainer) {
          if (friends.length === 0) {
            friendsContainer.innerHTML = `
              <div style="text-align: center; padding: 20px; color: #999;">
                <i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                <p>No friends yet</p>
                <p style="font-size: 12px;">Add some friends to get started!</p>
              </div>
            `;
          } else {
            friendsContainer.innerHTML = friends
              .map(
                (friend) => `
              <div class="friend-group">
                <div class="friend-data">
                  <span class="friend-avatar ${
                    friend.isOnline ? "" : "offline"
                  }">
                    ${
                      friend.avatar
                        ? `<i 
                        class="fa-solid fa-user" 
                        style="
                        width: 100%; 
                        height: 100%; 
                        object-fit: cover; 
                        border-radius: 50%; 
                        overflow:hidden; 
                        display: flex; 
                        justify-content:center; 
                        align-items: center; 
                        font-size: 25px;
                        ">
                        </i>`
                        : friend.username.charAt(0).toUpperCase()
                    }
                  </span>
                  <div class="friend-info">
                    <p class="friend-name">${friend.username}</p>
                    <span class="status">Level ${friend.level} • ${
                  friend.isOnline ? "Online" : "Offline"
                }</span>
                  </div>
                </div>
                <div class="friend-icons">
                  ${
                    friend.isOnline
                      ? '<i class="fa-solid fa-gamepad" title="Invite to game"></i>'
                      : ""
                  }
                  <i class="fa-regular fa-message" title="Send message"></i>
                  <i class="fa-solid fa-user-minus remove-friend-btn" title="Remove friend" data-user-id="${
                    friend.id
                  }" data-username="${
                  friend.username
                }" style="cursor: pointer; color: #dc3545;"></i>
                </div>
              </div>
            `
              )
              .join("");
          }
        }
      }
    } else {
      if (friendsContainer) {
        friendsContainer.innerHTML =
          '<div style="padding: 20px; text-align: center; color: #999;">Failed to load friends</div>';
      }
    }
  } catch (error) {
    console.error("Error loading friends:", error);
    if (friendsContainer) {
      friendsContainer.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #999;">Error loading friends</div>';
    }
  }
}

async function displayFriendsData(friends, friendsContainer) {
  // Update friends count in stats (assuming you have these elements)
  const friendsOnlineElements = document.querySelectorAll(
    ".state-group .state-info p"
  );
  if (friendsOnlineElements.length >= 4) {
    friendsOnlineElements[3].textContent = result.count.online;
  }

  const friendsTotalSpan = document.querySelectorAll(
    ".state-group .state-info span"
  );
  if (friendsTotalSpan[3]) {
    friendsTotalSpan[3].textContent = `of ${result.count.total} friends`;
  }

  // Display friends
  if (friendsContainer) {
    if (friends.length === 0) {
      friendsContainer.innerHTML = `
              <div style="text-align: center; padding: 20px; color: #999;">
                <i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                <p>No friends yet</p>
                <p style="font-size: 12px;">Add some friends to get started!</p>
              </div>
            `;
    } else {
      friendsContainer.innerHTML = friends
        .map(
          (friend) => `
              <div class="friend-group">
                <div class="friend-data">
                  <span class="friend-avatar ${
                    friend.isOnline ? "" : "offline"
                  }">
                    ${
                      friend.avatar
                        ? `<i 
                        class="fa-solid fa-user" 
                        style="
                        width: 100%; 
                        height: 100%; 
                        object-fit: cover; 
                        border-radius: 50%; 
                        overflow:hidden; 
                        display: flex; 
                        justify-content:center; 
                        align-items: center; 
                        font-size: 25px;
                        ">
                        </i>`
                        : friend.username.charAt(0).toUpperCase()
                    }
                  </span>
                  <div class="friend-info">
                    <p class="friend-name">${friend.username}</p>
                    <span class="status">Level ${friend.level} • ${
            friend.isOnline ? "Online" : "Offline"
          }</span>
                  </div>
                </div>
                <div class="friend-icons">
                  ${
                    friend.isOnline
                      ? '<i class="fa-solid fa-gamepad" title="Invite to game"></i>'
                      : ""
                  }
                  <i class="fa-regular fa-message" title="Send message"></i>
                  <i class="fa-solid fa-user-minus remove-friend-btn" title="Remove friend" data-user-id="${
                    friend.id
                  }" data-username="${
            friend.username
          }" style="cursor: pointer; color: #dc3545;"></i>
                </div>
              </div>
            `
        )
        .join("");
    }
  }
}

function startFriendsAutoRefresh() {
  // Refresh friends data every 15 seconds
  if (window.mainUtils.autoRefreshFriendsInterval) return;

  window.mainUtils.autoRefreshFriendsInterval = setInterval(() => {
    if (!document.hidden) {
      console.log("Auto-refreshing friends data...");
      loadFriendsData();
      loadPendingRequests();
    }
  }, 15000);
}

function setupFriendsEventListeners() {
  const addFriendBtn = document.querySelector(".add-friend-btn");
  addFriendBtn.addEventListener("click", addNewFriend);
  const friendsContainer = document.querySelector(".friend-content");
  friendsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-friend-btn")) {
      const userId = e.target.dataset.userId;
      const username = e.target.dataset.username;
      removeFriend(userId, username);
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".accept-btn")) {
      const button = e.target.closest(".accept-btn");
      const requestId = button.dataset.requestId;
      const username = button.dataset.username;
      acceptFriend(requestId, username);
    }

    if (e.target.closest(".decline-btn")) {
      const button = e.target.closest(".decline-btn");
      const requestId = button.dataset.requestId;
      const username = button.dataset.username;
      declineFriend(requestId, username);
    }

    if (e.target.closest(".cancel-btn")) {
      const button = e.target.closest(".cancel-btn");
      const requestId = button.dataset.requestId;
      const username = button.dataset.username;
      cancelFriendRequest(requestId, username);
    }
  });

  // Update visibility change handler to include friends data
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadFriendsData();
      loadPendingRequests();
    }
  });

  // Update online status handler to refresh friends data
  window.addEventListener("online", () => {
    loadFriendsData();
    loadPendingRequests();
  });
}

function initializeFriends() {
  loadFriendsData();
  loadPendingRequests();
  setupFriendsEventListeners();
  startFriendsAutoRefresh();
}

// Export functions for use in other modules
window.friendsUtils = {
  addNewFriend,
  removeFriend,
  acceptFriend,
  declineFriend,
  cancelFriendRequest,
  loadFriendsData,
  loadPendingRequests,
  displayPendingRequests,
  startFriendsAutoRefresh,
  setupFriendsEventListeners,
  initializeFriends,
};
