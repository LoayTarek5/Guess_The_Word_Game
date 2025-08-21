let currentFriendsPage = 1;

async function addNewFriend() {
  const username = document.querySelector(".search-username").value;
  // const username = prompt("Enter username to add as friend:");
  // if (!username || username.trim() === "") return;

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
      // Reload current page, but check if we need to go back a page
      const friendGroups = document.querySelectorAll(".friend-group");
      if (friendGroups.length === 1 && currentFriendsPage > 1) {
        // If this was the last friend on the page and we're not on page 1
        currentFriendsPage = currentFriendsPage - 1;
      }
      loadFriendsData(currentFriendsPage);
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
      loadFriendsData(currentFriendsPage);
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

    const friendsSection = document.querySelector(".send-request");
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

async function loadFriendsData(page = 1, limit = 8, isDashboard = false) {
  const friendsContainer = document.querySelector(".friend-content");

  try {
    const response = await fetch(`/api/friends?page=${page}&limit=${limit}`, {
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();

      if (result.success) {
        const friends = result.friends;
        const pagination = result.pagination;

        // Update friends count in stats
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

        // Update header
        document.querySelector(
          ".header-friend h3"
        ).textContent = `Friends (${result.count.total})`;

        // Display friends
        if (friendsContainer) {
          if (friends.length === 0 && pagination.currentPage === 1) {
            friendsContainer.innerHTML = `
              <div style="text-align: center; padding: 20px; color: #999;">
                <i class="fas fa-user-friends" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                <p>No friends yet</p>
                <p style="font-size: 12px;">Add some friends to get started!</p>
              </div>
            `;
          } else {
            const friendsHTML = friends
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
                        ? '<div class="icon invite"><i class="fa-solid fa-gamepad" title="Invite to game"></i> <span>Challenge</span></div>'
                        : ""
                    }
                  <div class="icon message-friend">
                    <i class="fa-regular fa-message" title="Send message"></i>
                    <span>Message</span>
                  </div>
                  <div class="icon remove-friend">
                    <i class="fa-solid fa-user-minus remove-friend-btn" title="Remove friend" data-user-id="${
                      friend.id
                    }" data-username="${
                    friend.username
                    }" style="cursor: pointer; color: #dc3545;"></i>
                    <span>Remove Friend</span>
                  </div>
                </div>
              </div>
            `
              )
              .join("");
            // Create pagination HTML
            if (!isDashboard) {
              const paginationHTML = createPaginationHTML(pagination);
              friendsContainer.innerHTML = friendsHTML + paginationHTML;
            } else {
              friendsContainer.innerHTML = friendsHTML;
            }
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
      loadFriendsData(currentFriendsPage);
      loadPendingRequests();
    }
  }, 150000);
}

function setupFriendsEventListeners() {
  const addFriendBtn = document.querySelector(".search-container .sent");
  addFriendBtn.addEventListener("click", addNewFriend);
  const friendsContainer = document.querySelector(".friend-content");
  friendsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-friend-btn")) {
      const userId = e.target.dataset.userId;
      const username = e.target.dataset.username;
      removeFriend(userId, username);
    }
  });

  // Handle pagination clicks
  friendsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // Only handle pagination buttons
    if (
      btn.classList.contains("page-curr") ||
      btn.classList.contains("page-slide") ||
      btn.classList.contains("page-ellipsis")
    ) {
      e.preventDefault();

      if (btn.disabled) return;

      const page = parseInt(btn.dataset.page, 10);
      if (page && page !== currentFriendsPage) {
        currentFriendsPage = page;
        loadFriendsData(page);
      }
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
      loadFriendsData(currentFriendsPage);
      loadPendingRequests();
    }
  });

  // Update online status handler to refresh friends data
  window.addEventListener("online", () => {
    loadFriendsData(currentFriendsPage);
    loadPendingRequests();
  });
}

function initializeFriends() {
  loadFriendsData(1);
  loadPendingRequests();
  setupFriendsEventListeners();
  startFriendsAutoRefresh();
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
    totalFriends,
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
        <p>Showing ${startIndex} to ${endIndex} of ${totalFriends} friends</p>
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
  currentFriendsPage: () => currentFriendsPage,
};
