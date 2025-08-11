async function loadMatchHistory(limit = 10, page = 1) {
  try {
    const response = await fetch(
      `/api/matchHistory/history?limit=${limit}&page=${page}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        displayMatchHistory(result.matchHistory);
      } else {
        console.error("Failed to load match history:", result.message);
      }
    } else {
      console.error("Failed to fetch match history");
    }
  } catch (error) {
    console.error("Error loading match history:", error);
  }
}

function displayMatchHistory(matches) {
  const matchesContent = document.querySelector(".matches-content");

  if (!matchesContent) {
    console.warn("Matches content container not found");
    return;
  }

  if (matches.length === 0) {
    matchesContent.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #999;">
        <i class="fas fa-gamepad" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>No matches played yet</p>
        <p style="font-size: 12px;">Start playing to see your match history!</p>
      </div>
    `;
    return;
  }

  matchesContent.innerHTML = matches
    .map(
      (match) => `
    <div class="match-data">
      <div class="match-info">
        <span class="avatar">
          <i class="fa-solid fa-user"></i>
        </span>
        <div class="wrap-info">
          <div class="match-status-wrapper">
            <div class="match-status ${match.result.status}">
              <i class="fas ${getResultIcon(match.result.status)}"></i>
              ${match.result.display}
            </div>
            <p class="name">${match.opponentDisplay}</p>
          </div>
          <div class="details">
            <span class="time">${match.timeAgo}</span>
            <span class="dot-space">•</span>
            <span class="date">${match.date}</span>
            <span class="dot-space">•</span>
            <span class="Duration">Duration: ${match.durationDisplay}</span>
            <span class="dot-space">•</span>
            <span class="word">Word: ${(
              match.word || "UNKNOWN"
            ).toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div class="match-stats">
        <div class="match-result">
          <span class="you">${match.yourScore}</span>-<span class="opp">${
        match.opponentScore
      }</span>
        </div>
        <span class="num-guess">${match.guessesDisplay}</span>
      </div>
    </div>
  `
    )
    .join("");
}

function displayMatchHistoryError(message) {
  const matchesContent = document.querySelector(".matches-content");
  if (matchesContent) {
    matchesContent.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #dc3545;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>${message}</p>
        <button onclick="window.matchHistoryUtils.loadMatchHistory()" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">
          <i class="fas fa-redo" style="margin-right: 5px;"></i>
          Retry
        </button>
      </div>
    `;
  }
}

function displayMatchHistoryLoading() {
  const matchesContent = document.querySelector(".matches-content");
  if (matchesContent) {
    matchesContent.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #666;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>Loading match history...</p>
      </div>
    `;
  }
}

function getResultIcon(status) {
  switch (status) {
    case "won":
      return "fa-trophy";
    case "lost":
      return "fa-times-circle";
    case "draw":
      return "fa-handshake";
    default:
      return "fa-gamepad";
  }
}

function startMatchHistoryAutoRefresh(interval = 30000) {
  if (window.mainUtils.matchHistoryAutoRefreshInterval) {
    clearInterval(window.mainUtils.matchHistoryAutoRefreshInterval);
  }

  window.mainUtils.matchHistoryAutoRefreshInterval = setInterval(() => {
    if (!document.hidden) {
      console.log("Auto-refreshing match history...");
      loadMatchHistory();
    }
  }, interval);
}

function stopMatchHistoryAutoRefresh() {
  if (window.mainUtils.matchHistoryAutoRefreshInterval) {
    clearInterval(window.mainUtils.matchHistoryAutoRefreshInterval);
    window.mainUtils.matchHistoryAutoRefreshInterval = null;
  }
}

function setupMatchHistoryEventListeners() {
  // Update visibility change handler to include match history
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadMatchHistory();
    }
  });

  // Update online status handler to refresh match history
  window.addEventListener("online", () => {
    loadMatchHistory();
  });
}

function initializeMatchHistory() {
  loadMatchHistory();
  setupMatchHistoryEventListeners();
  startMatchHistoryAutoRefresh();
}

window.matchHistoryUtils = {
  loadMatchHistory,
  displayMatchHistory,
  displayMatchHistoryError,
  displayMatchHistoryLoading,
  getResultIcon,
  startMatchHistoryAutoRefresh,
  stopMatchHistoryAutoRefresh,
  setupMatchHistoryEventListeners,
  initializeMatchHistory,
};
