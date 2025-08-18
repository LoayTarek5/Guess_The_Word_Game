let currentMatchesPage = 1;

async function loadMatchHistory(page = 1, limit = 10) {
  try {
    const response = await fetch(
      `/api/matchHistory/history?page=${page}&limit=${limit}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        displayMatchHistory(result.matchHistory, result.pagination);
        const header = document.querySelector(".matches-section h3");
        if (header && result.count?.total) {
          header.textContent = `Recent Matches (${result.count.total})`;
        }
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

function displayMatchHistory(matches, pagination) {
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

  const matchesHtml = matches
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
  const paginationHTML = createPaginationHTML(pagination);
  matchesContent.innerHTML = matchesHtml + paginationHTML;
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
            Back
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
            Next
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  `;
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
      loadMatchHistory(currentMatchesPage);
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
  const matchesContent = document.querySelector(".matches-content");

  if (!matchesContent) {
    console.warn("Matches content container not found");
    return;
  }

  matchesContent.addEventListener("click", (e) => {
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
      if (page && page !== currentMatchesPage) {
        currentMatchesPage = page;
        loadMatchHistory(page);
      }
    }
  });

  document.getElementById("dropdownBtn").addEventListener("click", function () {
    document.getElementById("dropdownMenu").classList.toggle("show");
  });

  const inputs = document.querySelectorAll("#dropdownMenu input");
  inputs.forEach((ele) => {
    ele.addEventListener("click", (e) => {
      document.querySelectorAll(".dropdown-item").forEach((label) => {
        label.classList.remove("selected");
      });

      e.target.parentElement.classList.add("selected");

      const buttonText =
        e.target.parentElement.querySelector("span").textContent;
      document.querySelector("#dropdownBtn span").textContent = buttonText;
    });
  });

  // Update visibility change handler to include match history
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadMatchHistory(currentMatchesPage);
    }
  });

  // Update online status handler to refresh match history
  window.addEventListener("online", () => {
    loadMatchHistory(currentMatchesPage);
  });
}

function initializeMatchHistory() {
  loadMatchHistory(1);
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
  getCurrentPage: () => currentMatchesPage,
};
