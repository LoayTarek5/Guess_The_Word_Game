let currentMatchesPage = 1;
let currentFilters = {
  search: '',
  result: 'all'
};

async function loadMatchHistory(page = 1, limit = 10) {
  try {
    // Build query parameters
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    // Add filter parameters if they exist
    if (currentFilters.search.trim()) {
      params.append('search', currentFilters.search.trim());
    }
    if (currentFilters.result && currentFilters.result !== 'all') {
      params.append('result', currentFilters.result);
    }

    const response = await fetch(
      `/api/matchHistory/history?${params.toString()}`,
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
        if (header && result.count?.total !== undefined) {
          const filterText = getFilterDisplayText();
          header.textContent = `${filterText} (${result.count.total})`;
        }
      } else {
        console.error("Failed to load match history:", result.message);
        displayMatchHistoryError(result.message || "Failed to load match history");
      }
    } else {
      console.error("Failed to fetch match history");
      displayMatchHistoryError("Failed to fetch match history");
    }
  } catch (error) {
    console.error("Error loading match history:", error);
    displayMatchHistoryError("Error loading match history");
  }
}

function getFilterDisplayText() {
  const hasSearch = currentFilters.search.trim().length > 0;
  const hasResultFilter = currentFilters.result !== 'all';
  
  if (!hasSearch && !hasResultFilter) {
    return "Recent Matches";
  }
  
  let text = "Filtered Matches";
  
  if (hasResultFilter) {
    const resultText = currentFilters.result.charAt(0).toUpperCase() + currentFilters.result.slice(1);
    text = `${resultText} Only`;
  }
  
  if (hasSearch) {
    text += hasResultFilter ? ` - "${currentFilters.search}"` : ` - "${currentFilters.search}"`;
  }
  
  return text;
}

function displayMatchHistory(matches, pagination) {
  const matchesContent = document.querySelector(".matches-content");

  if (!matchesContent) {
    console.warn("Matches content container not found");
    return;
  }

  if (matches.length === 0) {
    const hasFilters = currentFilters.search.trim() || currentFilters.result !== 'all';
    const emptyMessage = hasFilters 
      ? `No matches found matching your filters.`
      : `No matches played yet`;
    const emptySubtext = hasFilters 
      ? `Try adjusting your search or filter criteria.`
      : `Start playing to see your match history!`;

    matchesContent.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #999;">
        <i class="fas fa-${hasFilters ? 'filter' : 'gamepad'}" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>${emptyMessage}</p>
        <p style="font-size: 12px;">${emptySubtext}</p>
        ${hasFilters ? `
          <button onclick="clearAllFilters()" style="margin-top: 15px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">
            <i class="fas fa-times" style="margin-right: 5px;"></i>
            Clear Filters
          </button>
        ` : ''}
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

// Filter functions
function applyFilters() {
  currentMatchesPage = 1; // Reset to first page when applying filters
  displayMatchHistoryLoading();
  loadMatchHistory(currentMatchesPage);
}

function clearAllFilters() {
  // Clear search input
  const searchInput = document.querySelector('.search-match');
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Reset dropdown to "All Results"
  const allResultsRadio = document.querySelector('input[value="all"]');
  if (allResultsRadio) {
    allResultsRadio.checked = true;
    
    // Update dropdown display
    document.querySelectorAll(".dropdown-item").forEach((label) => {
      label.classList.remove("selected");
    });
    allResultsRadio.parentElement.classList.add("selected");
    
    const dropdownBtn = document.querySelector("#dropdownBtn span");
    if (dropdownBtn) {
      dropdownBtn.textContent = "All Results";
    }
  }
  
  // Clear filters and reload
  currentFilters = {
    search: '',
    result: 'all'
  };
  
  applyFilters();
}

let searchTimeout;
function handleSearchInput(value) {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // Debounce search input
  searchTimeout = setTimeout(() => {
    currentFilters.search = value;
    applyFilters();
  }, 500); // Wait 500ms after user stops typing
}

function handleResultFilter(value) {
  currentFilters.result = value;
  applyFilters();
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
        displayMatchHistoryLoading();
        loadMatchHistory(page);
      }
    }
  });

  // Setup search input listener
  const searchInput = document.querySelector('.search-match');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleSearchInput(e.target.value);
    });
  }

  // Setup dropdown functionality
  if (document.getElementById("dropdownBtn")) {
    document
      .getElementById("dropdownBtn")
      .addEventListener("click", function () {
        document.getElementById("dropdownMenu").classList.toggle("show");
      });
  }

  const inputs = document.querySelectorAll("#dropdownMenu input");
  if (inputs) {
    inputs.forEach((ele) => {
      ele.addEventListener("click", (e) => {
        document.querySelectorAll(".dropdown-item").forEach((label) => {
          label.classList.remove("selected");
        });

        e.target.parentElement.classList.add("selected");

        const buttonText =
          e.target.parentElement.querySelector("span").textContent;
        document.querySelector("#dropdownBtn span").textContent = buttonText;
        
        // Apply result filter
        handleResultFilter(e.target.value);
      });
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('dropdownMenu');
    const dropdownBtn = document.getElementById('dropdownBtn');
    
    if (dropdown && dropdownBtn && !dropdownBtn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
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

// Make clearAllFilters globally available
window.clearAllFilters = clearAllFilters;

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
  getCurrentFilters: () => currentFilters,
  applyFilters,
  clearAllFilters,
  handleSearchInput,
  handleResultFilter
};