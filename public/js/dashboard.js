// Production-ready dashboard.js with hybrid approach
document.addEventListener("DOMContentLoaded", function () {
  // Production-ready authentication check
  checkAuthentication();

  // Load from localStorage first (instant display)
  loadUserDataFromStorage();

  // Then fetch from server (get updated data)
  fetchUserDataFromServer();

  // Setup logout functionality
  setupLogoutButton();

  startPeriodicAuthCheck();
});

async function checkAuthentication() {
  const user = localStorage.getItem("user");

  if (!user) {
    console.log("No user data in localStorage, redirecting to login");
    window.location.href = "/auth/login";
    return false;
  }

  // Verify with server using cookies
  try {
    const response = await fetch("/auth/me", {
      credentials: "include", // Send cookies
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log("User authenticated successfully");
        return true;
      }
    }

    //  Handle 401 - user is not authenticated
    if (response.status === 401) {
      console.log("User not authenticated, redirecting to login");
      localStorage.removeItem("user");
      window.location.href = "/auth/login";
      return false;
    }

    // Handle other errors
    console.log("Auth verification failed with status:", response.status);
  } catch (error) {
    console.log("Network error during auth check, using cached data");
    // Continue with cached data if network fails
  }

  return true;
}

function loadUserDataFromStorage() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (user.username) {
      displayUserData(user, "localStorage");
    } else {
      document.getElementById("username").textContent = "Guest";
    }
  } catch (error) {
    console.error("Error loading user data from storage:", error);
    document.getElementById("username").textContent = "Guest";
  }
}

//  Production-ready server data fetch
async function fetchUserDataFromServer() {
  try {
    const response = await fetch("/auth/me", {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const result = await response.json();

      if (result.success) {
        // Update localStorage with fresh data
        localStorage.setItem("user", JSON.stringify(result.user));

        // Display updated data
        displayUserData(result.user, "server");
      } else {
        console.error("Failed to fetch user data:", result.message);
      }
    } else if (response.status === 401) {
      // Not authenticated, redirect
      const result = await response.json();

      //  Handle cross-browser logout
      if (result.message.includes("logout from another device")) {
        showNotification(
          "You have been logged out from another device",
          "warning"
        );
        setTimeout(() => {
          localStorage.removeItem("user");
          window.location.href = "/auth/login";
        }, 2000);
      } else {
        localStorage.removeItem("user");
        window.location.href = "/auth/login";
      }
    } else {
      console.error("Server error fetching user data");
    }
  } catch (error) {
    console.error("Network error fetching user data:", error);
  }
}

// periodic authentication check (every 30 seconds)
function startPeriodicAuthCheck() {
  setInterval(async () => {
    if (!document.hidden) { // Only check if tab is active
      try {
        const response = await fetch("/auth/me", {
          credentials: "include",
        });

        if (response.status === 401) {
          const result = await response.json();
          
          if (result.message.includes("logout from another device")) {
            showNotification("You have been logged out from another device", "warning");
            setTimeout(() => {
              localStorage.removeItem("user");
              window.location.href = "/auth/login";
            }, 2000);
          }
        }
      } catch (error) {
        // Ignore network errors in periodic check
        console.log("Periodic auth check failed:", error.message);
      }
    }
  }, 30000); // Check every 30 seconds
}

function displayUserData(user, source) {
  const usernameElement = document.getElementById("username");
  const currentUsername = usernameElement.textContent;

  if (currentUsername !== user.username && currentUsername !== "Loading...") {
    // Animate username change
    usernameElement.style.transform = "scale(1.1)";
    usernameElement.style.color = "#28a745";

    setTimeout(() => {
      usernameElement.textContent = user.username;
      setTimeout(() => {
        usernameElement.style.transform = "scale(1)";
        usernameElement.style.color = "#667eea";
      }, 200);
    }, 100);
  } else {
    usernameElement.textContent = user.username;
  }
}

// logout function
function setupLogoutButton() {
  const logoutBtn = document.getElementById("logout-btn");
  const btnText = logoutBtn.querySelector(".btn-text");
  const btnLoader = logoutBtn.querySelector(".btn-loader");

  logoutBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to logout?")) {
      try {
        setLogoutButtonLoading(true);

        // Call server logout with cookies
        try {
          await fetch("/auth/logout", {
            method: "POST",
            credentials: "include", // Send cookies
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          console.log("Server logout failed, but continuing with local logout");
        }

        // Clear local storage (only user data, no token)
        localStorage.removeItem("user");

        showNotification("Logged out successfully!", "success");

        setTimeout(() => {
          window.location.href = "/auth/login";
        }, 1000);
      } catch (error) {
        // Even if server logout fails, clear local data
        localStorage.removeItem("user");
        showNotification("Logged out locally (network error)", "warning");
        
        setTimeout(() => {
          window.location.href = "/auth/login";
        }, 1000);
        setLogoutButtonLoading(false);
      }
    }
  });

  function setLogoutButtonLoading(loading) {
    logoutBtn.disabled = loading;
    if (loading) {
      btnText.style.display = "none";
      btnLoader.style.display = "inline-block";
    } else {
      btnText.style.display = "inline-block";
      btnLoader.style.display = "none";
    }
  }
}

// notification system
function showNotification(message, type = "info") {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll(".notification");
  existingNotifications.forEach((notification) => {
    notification.remove();
  });

  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  // Style the notification
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        min-width: 250px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Geist', sans-serif;
    `;

  // Add icon and set background based on type
  let icon = "";
  switch (type) {
    case "success":
      notification.style.backgroundColor = "#28a745";
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case "error":
      notification.style.backgroundColor = "#dc3545";
      icon = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case "warning":
      notification.style.backgroundColor = "#ffc107";
      notification.style.color = "#212529";
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    case "info":
    default:
      notification.style.backgroundColor = "#17a2b8";
      icon = '<i class="fas fa-info-circle"></i>';
  }

  notification.innerHTML = `${icon}<span>${message}</span>`;

  // Add to page
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 100);

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(400px)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Production-ready network status handling
window.addEventListener("online", () => {
  console.log("Connection restored, refreshing data...");
  showNotification("Connection restored!", "success");
  fetchUserDataFromServer();
});

window.addEventListener("offline", () => {
  console.log("Connection lost, using cached data...");
  showNotification("Connection lost - using cached data", "warning");
});

//  Handle visibility change (when user switches tabs)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    // User returned to tab, refresh data
    console.log("User returned, refreshing data...");
    fetchUserDataFromServer();
  }
});

// Handle browser back button
window.addEventListener("popstate", () => {
  if (!checkAuthentication()) {
    window.location.href = "/auth/login";
  }
});

