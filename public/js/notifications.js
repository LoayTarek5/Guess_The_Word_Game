let currentNotificationsPage = 1;
let currentNotificationFilters = {
  search: "",
  type: "all",
  sort: "newest",
};

async function loadNotifications(page = 1, limit = 8) {
  try {
    // Build query parameters
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    // Add filter parameters if they exist
    if (currentNotificationFilters.search.trim()) {
      params.append("search", currentNotificationFilters.search.trim());
    }
    if (
      currentNotificationFilters.type &&
      currentNotificationFilters.type !== "all"
    ) {
      params.append("type", currentNotificationFilters.type);
    }
    if (
      currentNotificationFilters.sort &&
      currentNotificationFilters.sort !== "newest"
    ) {
      params.append("sort", currentNotificationFilters.sort);
    }

    const response = await fetch(`/api/notifications?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        displayNotifications(result.data.notifications, result.data.pagination);
        updateNotificationCount(result.data.pagination.totalNotifications);
        const header = document.querySelector(".notifications-section h2");
        if (
          header &&
          result.data.pagination?.totalNotifications !== undefined
        ) {
          const filterText = getNotificationFilterDisplayText();
          header.textContent = `${filterText} (${result.data.pagination.totalNotifications})`;
        }
      } else {
        console.error("Failed to load notifications:", result.message);
        displayNotificationsError(
          result.message || "Failed to load notifications"
        );
      }
    } else {
      console.error("Failed to fetch notifications");
      displayNotificationsError("Failed to fetch notifications");
    }
  } catch (error) {
    console.error("Error loading notifications:", error);
    displayNotificationsError("Error loading notifications");
  }
}

function getNotificationFilterDisplayText() {
  const hasSearch = currentNotificationFilters.search.trim().length > 0;
  const hasTypeFilter = currentNotificationFilters.type !== "all";
  const hasSortFilter = currentNotificationFilters.sort !== "newest";

  if (!hasSearch && !hasTypeFilter && !hasSortFilter) {
    return "Notifications";
  }

  let text = "Filtered Notifications";

  if (hasTypeFilter) {
    const typeText = getNotificationTypeDisplayName(
      currentNotificationFilters.type
    );
    text = `${typeText} Only`;
  }

  if (hasSearch) {
    text += hasTypeFilter
      ? ` - "${currentNotificationFilters.search}"`
      : ` - "${currentNotificationFilters.search}"`;
  }

  return text;
}

function getNotificationTypeDisplayName(type) {
  const typeMap = {
    friend_request: "Friend Requests",
    friend_accepted: "Friend Accepted",
    game_invitation: "Game Invitations",
    room_invitation: "Room Invitations",
    game_started: "Game Started",
    achievement: "Achievements",
    system: "System",
    chat_message: "Messages",
  };

  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function displayNotifications(notifications, pagination) {
  const notificationsContent = document.querySelector(".notifications-list");

  if (!notificationsContent) {
    console.warn("Notifications content container not found");
    return;
  }

  if (notifications.length === 0) {
    const hasFilters =
      currentNotificationFilters.search.trim() ||
      currentNotificationFilters.type !== "all" ||
      currentNotificationFilters.sort !== "newest";
    const emptyMessage = hasFilters
      ? `No notifications found matching your filters.`
      : `No notifications yet`;
    const emptySubtext = hasFilters
      ? `Try adjusting your search or filter criteria.`
      : `You'll see notifications here when they arrive!`;

    notificationsContent.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #999;">
        <i class="fas fa-${
          hasFilters ? "filter" : "bell-slash"
        }" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>${emptyMessage}</p>
        <p style="font-size: 12px;">${emptySubtext}</p>
        ${
          hasFilters
            ? `
          <button class="clr-notification-filters" style="margin-top: 15px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">
            <i class="fas fa-times" style="margin-right: 5px;"></i>
            Clear Filters
          </button>
        `
            : ""
        }
      </div>
    `;
    return;
  }

  const notificationsHtml = notifications
    .map((notification) => {
      const typeInfo = getNotificationTypeInfo(notification.type);
      const unreadClass = notification.isRead ? "" : "unread";
      const badgeHTML = notification.isRead
        ? ""
        : '<span class="notification-badge"></span>';

      let actionsHTML = "";
      if (
        !notification.isRead &&
        ["friend_request", "game_invitation", "room_invitation"].includes(
          notification.type
        ) // Add room_invitation
      ) {
        actionsHTML = createActionsHTML(notification);
      }

      // Add room code display for room invitations
      let additionalInfo = "";
      if (
        notification.type === "room_invitation" &&
        notification.data?.roomInvitation?.roomCode
      ) {
        additionalInfo = `<div class="notification-room-code">Room Code: <strong>${notification.data.roomInvitation.roomCode}</strong></div>`;
      }

      return `
      <div class="notification-item ${unreadClass}" data-id="${
        notification._id
      }">
        <div class="notification-avatar ${typeInfo.class}">
          <i class="${typeInfo.icon}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-header">
            <div class="notification-info">
              <span class="notification-type">${typeInfo.displayName}</span>
              ${badgeHTML}
            </div>
            <div class="notification-icons">
              <i class="fa-regular fa-trash-can notification-delete" title="Delete notification"></i>
              ${
                !notification.isRead
                  ? '<i class="fa-regular fa-envelope-open notification-read" title="Mark as read"></i>'
                  : ""
              }
            </div>
          </div>
          <div class="notification-text">${notification.message}</div>
          ${additionalInfo}
          <div class="notification-time">${notification.timeAgo}</div>
          ${actionsHTML}
        </div>
      </div>
    `;
    })
    .join("");

  const paginationHTML = createNotificationsPaginationHTML(pagination);
  notificationsContent.innerHTML = notificationsHtml + paginationHTML;

  // Add event listeners to action buttons
  notificationsContent.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", handleNotificationAction);
  });
}

async function handleMarkAsRead(notificationId, notificationItem) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: "PATCH",
      credentials: "include",
    });

    if (response.ok) {
      // Update UI immediately
      notificationItem.classList.remove("unread");
      const badge = notificationItem.querySelector(".notification-badge");
      if (badge) {
        badge.remove();
      }
      const readIcon = notificationItem.querySelector(".notification-read");
      if (readIcon) {
        readIcon.remove();
      }

      // Refresh stats
      await loadNotificationStats();
      console.log("Notification marked as read");
    } else {
      console.error("Failed to mark notification as read");
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

async function handleDeleteNotification(notificationId, notificationItem) {
  // Show confirmation dialog
  if (!confirm("Are you sure you want to delete this notification?")) {
    return;
  }

  try {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.ok) {
      // Remove from UI with animation
      notificationItem.style.opacity = "0.5";
      notificationItem.style.transform = "translateX(-20px)";

      setTimeout(() => {
        notificationItem.remove();

        // Check if we need to reload the page (if this was the last item)
        const remainingItems = document.querySelectorAll(".notification-item");
        if (remainingItems.length === 0) {
          loadNotifications(currentNotificationsPage);
        }
      }, 300);

      // Refresh stats
      await loadNotificationStats();
      console.log("Notification deleted");
    } else {
      const error = await response.json();
      console.error(
        "Failed to delete notification:",
        error.message || "Delete failed"
      );
    }
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

function createNotificationsPaginationHTML(pagination) {
  if (pagination.totalPages <= 1) {
    return "";
  }

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalNotifications,
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
        <p>Showing ${startIndex} to ${endIndex} of ${totalNotifications} Notifications</p>
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

function displayNotificationsError(message) {
  const notificationsContent = document.querySelector(".notifications-list");
  if (notificationsContent) {
    notificationsContent.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #dc3545;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>${message}</p>
        <button class="notification-btn-err" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">
          <i class="fas fa-redo" style="margin-right: 5px;"></i>
          Retry
        </button>
      </div>
    `;
  }
}

function displayNotificationsLoading() {
  const notificationsContent = document.querySelector(".notifications-list");
  if (notificationsContent) {
    notificationsContent.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #666;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>Loading notifications...</p>
      </div>
    `;
  }
}

function getNotificationTypeInfo(type) {
  const typeMap = {
    friend_request: {
      displayName: "Friend Request",
      class: "friend-request",
      icon: "fas fa-user",
    },
    friend_accepted: {
      displayName: "Friend Accepted",
      class: "friend-request",
      icon: "fas fa-user-check",
    },
    game_invitation: {
      displayName: "Game Invitation",
      class: "game-invite",
      icon: "fas fa-gamepad",
    },
    room_invitation: {
      displayName: "Room Invitation",
      class: "room-invite",
      icon: "fas fa-door-open",
    },
    game_started: {
      displayName: "Game Started",
      class: "game-invite",
      icon: "fas fa-play",
    },
    achievement: {
      displayName: "Achievement Unlocked",
      class: "achievement",
      icon: "fas fa-trophy",
    },
    system: {
      displayName: "System Update",
      class: "system",
      icon: "fas fa-cog",
    },
    chat_message: {
      displayName: "New Message",
      class: "message",
      icon: "fas fa-comment",
    },
  };

  return (
    typeMap[type] || {
      displayName: "Notification",
      class: "system",
      icon: "fas fa-bell",
    }
  );
}

function createActionsHTML(notification) {
  if (notification.type === "friend_request") {
    return `
      <div class="notification-actions">
        <button class="action-btn accept" data-action="accept">
          <i class="fas fa-check"></i> Accept
        </button>
        <button class="action-btn decline" data-action="decline">
          <i class="fas fa-times"></i> Decline
        </button>
      </div>
    `;
  } else if (notification.type === "game_invitation") {
    return `
      <div class="notification-actions">
        <button class="action-btn join-game" data-action="accept">
          <i class="fas fa-gamepad"></i> Join Game
        </button>
        <button class="action-btn decline" data-action="decline">
          <i class="fas fa-times"></i> Decline
        </button>
      </div>
    `;
  } else if (notification.type === "room_invitation") {
    return `
      <div class="notification-actions">
        <button class="action-btn join-room" data-action="accept">
          <i class="fas fa-door-open"></i> Join Room
        </button>
        <button class="action-btn decline" data-action="decline">
          <i class="fas fa-times"></i> Decline
        </button>
      </div>
    `;
  }
  return "";
}

// Filter functions
function applyNotificationFilters() {
  currentNotificationsPage = 1; // Reset to first page when applying filters
  displayNotificationsLoading();
  loadNotifications(currentNotificationsPage);
}

function clearAllNotificationFilters() {
  // Clear search input
  const searchInput = document.querySelector(".search-notifications");
  if (searchInput) {
    searchInput.value = "";
  }

  // Reset type dropdown to "All Types"
  const allTypesRadio = document.querySelector(
    '#typeDropdownMenu input[value="all"]'
  );
  if (allTypesRadio) {
    allTypesRadio.checked = true;

    // Update dropdown display
    document
      .querySelectorAll("#typeDropdownMenu .dropdown-item")
      .forEach((label) => {
        label.classList.remove("selected");
      });
    allTypesRadio.parentElement.classList.add("selected");

    const typeDropdownBtn = document.querySelector("#typeDropdownBtn span");
    if (typeDropdownBtn) {
      typeDropdownBtn.textContent = "All Types";
    }
  }

  // Reset sort dropdown to "Newest First"
  const newestSortRadio = document.querySelector(
    '#sortDropdownMenu input[value="newest"]'
  );
  if (newestSortRadio) {
    newestSortRadio.checked = true;

    // Update dropdown display
    document
      .querySelectorAll("#sortDropdownMenu .dropdown-item")
      .forEach((label) => {
        label.classList.remove("selected");
      });
    newestSortRadio.parentElement.classList.add("selected");

    const sortDropdownBtn = document.querySelector("#sortDropdownBtn span");
    if (sortDropdownBtn) {
      sortDropdownBtn.textContent = "Newest First";
    }
  }

  // Clear filters and reload
  currentNotificationFilters = {
    search: "",
    type: "all",
    sort: "newest",
  };

  applyNotificationFilters();
}

let notificationSearchTimeout;
function handleNotificationSearchInput(value) {
  // Clear previous timeout
  if (notificationSearchTimeout) {
    clearTimeout(notificationSearchTimeout);
  }

  // Debounce search input
  notificationSearchTimeout = setTimeout(() => {
    currentNotificationFilters.search = value;
    applyNotificationFilters();
  }, 500); // Wait 500ms after user stops typing
}

function handleNotificationTypeFilter(value) {
  currentNotificationFilters.type = value;
  applyNotificationFilters();
}

function handleNotificationSortFilter(value) {
  currentNotificationFilters.sort = value;
  applyNotificationFilters();
}

async function handleNotificationAction(event) {
  const button = event.target.closest(".action-btn");
  const notificationItem = button.closest(".notification-item");
  const notificationId = notificationItem.dataset.id;
  const action = button.dataset.action;

  // Disable button and show loading
  const originalContent = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

  try {
    const response = await fetch(
      `/api/notifications/${notificationId}/action`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ action }),
      }
    );

    if (response.ok) {
      const result = await response.json();

      // Handle successful action
      if (action === "accept" && result.data?.roomId) {
        if (result.data.roomCode) {
          sessionStorage.setItem(
            "currentRoom",
            JSON.stringify({
              roomId: result.data.roomId,
              roomCode: result.data.roomCode,
              joined: true,
            })
          );
        }
        window.location.href = `/room/${result.data.roomId}`;
        return;
      }

      // Mark notification as read and refresh
      notificationItem.classList.remove("unread");
      const actionsDiv = notificationItem.querySelector(
        ".notification-actions"
      );
      if (actionsDiv) {
        actionsDiv.remove();
      }
      const badge = notificationItem.querySelector(".notification-badge");
      if (badge) {
        badge.remove();
      }

      // Show success message if available
      if (result.message) {
        console.log(result.message);
      }

      // Refresh stats and notifications
      await loadNotificationStats();
    } else {
      const error = await response.json();
      console.error("Action failed:", error.message || "Action failed");
      displayNotificationsError(error.message || "Action failed");
    }
  } catch (error) {
    console.error("Error handling notification action:", error);
    displayNotificationsError("Network error occurred");
  } finally {
    // Re-enable button
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

async function handleMarkAllNotificationsRead() {
  const button = document.querySelector(".mark-all-btn");
  if (!button) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Marking...";

  try {
    const response = await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",
    });

    if (response.ok) {
      // Remove unread styling from all notifications
      document.querySelectorAll(".notification-item.unread").forEach((item) => {
        item.classList.remove("unread");
        const badge = item.querySelector(".notification-badge");
        if (badge) {
          badge.remove();
        }
        const actions = item.querySelector(".notification-actions");
        if (actions) {
          actions.remove();
        }
      });

      // Refresh stats
      await loadNotificationStats();
      console.log("All notifications marked as read");
    } else {
      console.error("Failed to mark all notifications as read");
      displayNotificationsError("Failed to mark all notifications as read");
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    displayNotificationsError("Network error occurred");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function updateNotificationCount(count) {
  const countElement = document.querySelector(".notifications-section h2");
  if (countElement) {
    const filterText = getNotificationFilterDisplayText();
    countElement.textContent = `${filterText} (${count})`;
  }
}

function startNotificationsAutoRefresh(interval = 30000) {
  if (window.mainUtils.notificationsAutoRefreshInterval) {
    clearInterval(window.mainUtils.notificationsAutoRefreshInterval);
  }

  window.mainUtils.notificationsAutoRefreshInterval = setInterval(() => {
    if (!document.hidden) {
      console.log("Auto-refreshing notifications...");
      loadNotifications(currentNotificationsPage);
    }
  }, interval);
}

function stopNotificationsAutoRefresh() {
  if (window.mainUtils.notificationsAutoRefreshInterval) {
    clearInterval(window.mainUtils.notificationsAutoRefreshInterval);
    window.mainUtils.notificationsAutoRefreshInterval = null;
  }
}

function setupNotificationsEventListeners() {
  const notificationsContent = document.querySelector(".notifications-list");

  if (!notificationsContent) {
    console.warn("Notifications content container not found");
    return;
  }

  notificationsContent.addEventListener("click", (e) => {

    if(e.target.classList.contains("notification-btn-err")) {
      loadNotifications();
    }

    const btn = e.target.closest("button");
    const icon = e.target.closest("i");

    if (icon) {
      if (icon.classList.contains("notification-delete")) {
        e.preventDefault();
        const notificationItem = icon.closest(".notification-item");
        const notificationId = notificationItem.dataset.id;
        handleDeleteNotification(notificationId, notificationItem);
        return;
      }

      if (icon.classList.contains("notification-read")) {
        e.preventDefault();
        const notificationItem = icon.closest(".notification-item");
        const notificationId = notificationItem.dataset.id;
        handleMarkAsRead(notificationId, notificationItem);
        return;
      }
    }

    if (!btn) return;

    if (btn.classList.contains("clr-notification-filters")) {
      e.preventDefault();
      clearAllNotificationFilters();
      return;
    }

    // Only handle pagination buttons
    if (
      btn.classList.contains("page-curr") ||
      btn.classList.contains("page-slide") ||
      btn.classList.contains("page-ellipsis")
    ) {
      e.preventDefault();

      if (btn.disabled) return;

      const page = parseInt(btn.dataset.page, 10);
      if (page && page !== currentNotificationsPage) {
        currentNotificationsPage = page;
        displayNotificationsLoading();
        loadNotifications(page);
      }
    }
  });

  // Setup search input listener
  const searchInput = document.querySelector(".search-notifications");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleNotificationSearchInput(e.target.value);
    });
  }

  // Setup type filter dropdown functionality
  if (document.getElementById("typeDropdownBtn")) {
    document
      .getElementById("typeDropdownBtn")
      .addEventListener("click", function () {
        document.getElementById("typeDropdownMenu").classList.toggle("show");
        // Close sort dropdown if open
        const sortMenu = document.getElementById("sortDropdownMenu");
        if (sortMenu) {
          sortMenu.classList.remove("show");
        }
      });
  }

  // Setup sort dropdown functionality
  if (document.getElementById("sortDropdownBtn")) {
    document
      .getElementById("sortDropdownBtn")
      .addEventListener("click", function () {
        document.getElementById("sortDropdownMenu").classList.toggle("show");
        // Close type dropdown if open
        const typeMenu = document.getElementById("typeDropdownMenu");
        if (typeMenu) {
          typeMenu.classList.remove("show");
        }
      });
  }

  const typeInputs = document.querySelectorAll("#typeDropdownMenu input");
  if (typeInputs) {
    typeInputs.forEach((ele) => {
      ele.addEventListener("click", (e) => {
        document
          .querySelectorAll("#typeDropdownMenu .dropdown-item")
          .forEach((label) => {
            label.classList.remove("selected");
          });

        e.target.parentElement.classList.add("selected");

        const buttonText =
          e.target.parentElement.querySelector("span").textContent;
        document.querySelector("#typeDropdownBtn span").textContent =
          buttonText;

        // Apply type filter
        handleNotificationTypeFilter(e.target.value);
      });
    });
  }

  const sortInputs = document.querySelectorAll("#sortDropdownMenu input");
  if (sortInputs) {
    sortInputs.forEach((ele) => {
      ele.addEventListener("click", (e) => {
        document
          .querySelectorAll("#sortDropdownMenu .dropdown-item")
          .forEach((label) => {
            label.classList.remove("selected");
          });

        e.target.parentElement.classList.add("selected");

        const buttonText =
          e.target.parentElement.querySelector("span").textContent;
        document.querySelector("#sortDropdownBtn span").textContent =
          buttonText;

        // Apply sort filter
        handleNotificationSortFilter(e.target.value);
      });
    });
  }

  // Setup mark all read button
  const markAllBtn = document.querySelector(".mark-all-btn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", handleMarkAllNotificationsRead);
  }

  // Close dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    const typeDropdown = document.getElementById("typeDropdownMenu");
    const typeDropdownBtn = document.getElementById("typeDropdownBtn");
    const sortDropdown = document.getElementById("sortDropdownMenu");
    const sortDropdownBtn = document.getElementById("sortDropdownBtn");

    if (
      typeDropdown &&
      typeDropdownBtn &&
      !typeDropdownBtn.contains(e.target) &&
      !typeDropdown.contains(e.target)
    ) {
      typeDropdown.classList.remove("show");
    }

    if (
      sortDropdown &&
      sortDropdownBtn &&
      !sortDropdownBtn.contains(e.target) &&
      !sortDropdown.contains(e.target)
    ) {
      sortDropdown.classList.remove("show");
    }
  });

  // Update visibility change handler to include notifications
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadNotifications(currentNotificationsPage);
    }
  });

  // Update online status handler to refresh notifications
  window.addEventListener("online", () => {
    loadNotifications(currentNotificationsPage);
  });
}

function initializeNotifications() {
  loadNotificationStats();
  loadNotifications(1);
  setupNotificationsEventListeners();
  startNotificationsAutoRefresh();
}

async function loadNotificationStats() {
  try {
    const response = await fetch("/api/notifications/stats", {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        displayNotificationStats(result.data);
      } else {
        console.error("Failed to load notification stats:", result.message);
        displayNotificationStatsError();
      }
    } else {
      console.error("Failed to fetch notification stats");
      displayNotificationStatsError();
    }
  } catch (error) {
    console.error("Error loading notification stats:", error);
    displayNotificationStatsError();
  }
}

function displayNotificationStats(stats) {
  // Update Total Notifications
  const totalElement = document.getElementById("total-games");
  if (totalElement) {
    totalElement.textContent = stats.total.toLocaleString();
  }

  // Update Unread Notifications
  const unreadElement = document.getElementById("win-rate");
  if (unreadElement) {
    unreadElement.textContent = stats.unread.toLocaleString();
  }

  // Update Friend Requests
  const friendRequestsElement = document.getElementById("streak");
  if (friendRequestsElement) {
    friendRequestsElement.textContent = stats.friendRequests.toLocaleString();
  }

  // Update Game Invites
  const gameInvitesElement = document.getElementById("average-guesses");
  if (gameInvitesElement) {
    gameInvitesElement.textContent = stats.gameInvites.toLocaleString();
  }
}

function displayNotificationStatsError() {
  // Set default values when stats can't be loaded
  const totalElement = document.getElementById("total-games");
  if (totalElement) {
    totalElement.textContent = "0";
  }

  const unreadElement = document.getElementById("win-rate");
  if (unreadElement) {
    unreadElement.textContent = "0";
  }

  const friendRequestsElement = document.getElementById("streak");
  if (friendRequestsElement) {
    friendRequestsElement.textContent = "0";
  }

  const gameInvitesElement = document.getElementById("average-guesses");
  if (gameInvitesElement) {
    gameInvitesElement.textContent = "0";
  }
}

// Make clearAllNotificationFilters globally available
window.clearAllNotificationFilters = clearAllNotificationFilters;

window.notificationUtils = {
  loadNotifications,
  displayNotifications,
  displayNotificationsError,
  displayNotificationsLoading,
  getNotificationTypeInfo,
  startNotificationsAutoRefresh,
  stopNotificationsAutoRefresh,
  displayNotificationStats,
  setupNotificationsEventListeners,
  initializeNotifications,
  getCurrentPage: () => currentNotificationsPage,
  getCurrentFilters: () => currentNotificationFilters,
  applyNotificationFilters,
  clearAllNotificationFilters,
  handleNotificationSearchInput,
  handleNotificationTypeFilter,
  handleNotificationSortFilter,
  handleMarkAllNotificationsRead,
  handleMarkAsRead,
  handleDeleteNotification,
  loadNotificationStats,
};
