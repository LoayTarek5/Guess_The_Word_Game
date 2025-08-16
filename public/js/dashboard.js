let performanceChartInstance = null; // store chart instance

function displayUserStats(stats) {
  const totalGames = document.getElementById("total-games");
  const winRate = document.getElementById("win-rate");
  const numWinLose = document.getElementById("win-lose");
  const streak = document.getElementById("streak");
  const lvlNum = document.querySelector(".level-no");
  let rate =
    stats.totalGames == 0 ? 0 : (stats.gamesWon / stats.totalGames) * 100;
  totalGames.textContent = stats.totalGames;
  winRate.textContent = `${rate.toFixed(1)}%`;
  numWinLose.textContent = `${stats.gamesWon}W - ${stats.gamesLost}L - ${stats.gamesDraw}D`;
  streak.textContent = stats.winStreak;
  lvlNum.textContent = stats.level;
}

async function initializePerformanceChart() {
  const ctx = document.getElementById("performance-chart");
  if (!ctx) {
    console.warn("Performance chart canvas not found");
    return;
  }

  let performanceData;

  try {
    // Show loading state
    const chartContainer = ctx.parentElement;
    let loadingDiv;
    if (!performanceChartInstance) {
      loadingDiv = document.createElement("div");
      loadingDiv.className = "chart-loading";
      loadingDiv.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>Loading performance data...</p>
      </div>
    `;
      chartContainer.appendChild(loadingDiv);
    }
    // Fetch real performance data
    const response = await fetch("/api/matchHistory/performance?months=6", {
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        // Use real data from server
        const monthlyData = result.performanceOverview.monthlyData;
        performanceData = {
          labels: monthlyData.map((month) => month.month),
          datasets: [
            {
              label: "Wins",
              data: monthlyData.map((month) => month.wins),
              backgroundColor: "#10b981",
              borderColor: "#10b981",
              borderWidth: 2,
              borderRadius: 4,
              borderSkipped: false,
            },
            {
              label: "Losses",
              data: monthlyData.map((month) => month.losses),
              backgroundColor: "#ef4444",
              borderColor: "#ef4444",
              borderWidth: 2,
              borderRadius: 4,
              borderSkipped: false,
            },
          ],
        };

        // Update performance overview text
        updatePerformanceOverviewText(result.performanceOverview);
        if (loadingDiv) loadingDiv.remove();
        // Remove loading state
        /*if (loadingDiv.parentElement) {
          loadingDiv.parentElement.removeChild(loadingDiv);
        }*/
      } else {
        throw new Error("Failed to load performance data: " + result.message);
      }
    } else {
      throw new Error("Network error: " + response.status);
    }
  } catch (error) {
    console.error("Error loading performance data:", error);

    // Remove loading state
    document.querySelector(".chart-loading")?.remove();
    /*const loadingDiv = document.querySelector(".chart-loading");
    if (loadingDiv && loadingDiv.parentElement) {
      loadingDiv.parentElement.removeChild(loadingDiv);
    }*/

    // Show error state
    const chartContainer = ctx.parentElement;
    const errorDiv = document.createElement("div");
    errorDiv.className = "chart-error";
    errorDiv.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc3545;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>Failed to load performance data</p>
        <button onclick="initializePerformanceChart()" style="margin-top: 10px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">
          <i class="fas fa-redo" style="margin-right: 5px;"></i>
          Retry
        </button>
      </div>
    `;
    chartContainer.appendChild(errorDiv);
    return;
  }

  // If chart already exists, just update data instead of recreating
  if (performanceChartInstance) {
    performanceChartInstance.data = performanceData;
    performanceChartInstance.update();
  } else {
    // Create the chart
    performanceChartInstance = new Chart(ctx, {
      type: "bar",
      data: performanceData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              boxWidth: 12,
              padding: 20,
              font: {
                size: 12,
                family: "'Geist', sans-serif",
              },
            },
          },
          tooltip: {
            backgroundColor: "#333",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "#666",
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: {
              family: "'Geist', sans-serif",
            },
            bodyFont: {
              family: "'Geist', sans-serif",
            },
            callbacks: {
              afterLabel: function (context) {
                const dataIndex = context.dataIndex;
                const wins = performanceData.datasets[0].data[dataIndex];
                const losses = performanceData.datasets[1].data[dataIndex];
                const total = wins + losses;
                const winRate =
                  total > 0 ? Math.round((wins / total) * 100) : 0;
                return `Win Rate: ${winRate}%`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            border: {
              display: false,
            },
            ticks: {
              font: {
                family: "'Geist', sans-serif",
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "#f0f0f0",
            },
            border: {
              display: false,
            },
            ticks: {
              stepSize: 5,
              font: {
                family: "'Geist', sans-serif",
              },
            },
          },
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
      },
    });
  }
}

function updatePerformanceOverviewText(performanceOverview) {
  // Update the performance section title
  const performanceTitle = document.querySelector(".performance-section h3");
  if (performanceTitle) {
    performanceTitle.textContent = "Performance Overview";
  }

  // Update the section subtitle
  const sectionSubtitle = document.querySelector(
    ".performance-section .section-subtitle"
  );
  if (sectionSubtitle) {
    sectionSubtitle.textContent = `Your wins and losses over the ${performanceOverview.period.toLowerCase()}`;
  }

  // Update summary stats if elements exist
  const totalGamesEl = document.querySelector(
    '.performance-total-games, [data-stat="total-games"]'
  );
  const winRateEl = document.querySelector(
    '.performance-win-rate, [data-stat="win-rate"]'
  );

  if (totalGamesEl) {
    totalGamesEl.textContent = performanceOverview.summary.totalGames;
  }

  if (winRateEl) {
    winRateEl.textContent = `${performanceOverview.summary.overallWinRate}%`;
  }

  // If there's a stats summary container, update it
  const statsSummary = document.querySelector(".performance-stats-summary");
  if (statsSummary) {
    statsSummary.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Total Games:</span>
        <span class="stat-value">${performanceOverview.summary.totalGames}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Win Rate:</span>
        <span class="stat-value">${performanceOverview.summary.overallWinRate}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Wins:</span>
        <span class="stat-value">${performanceOverview.summary.totalWins}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Losses:</span>
        <span class="stat-value">${performanceOverview.summary.totalLosses}</span>
      </div>
    `;
  }
}

function startDashboardAutoRefresh() {
  // Refresh dashboard data every 5 minutes
  if (window.mainUtils.autoRefreshUserInterval) return;

  window.mainUtils.autoRefreshUserInterval = setInterval(() => {
    if (!document.hidden) {
      console.log("Auto-refreshing dashboard data...");
      window.mainUtils.fetchUserDataFromServer();
      // Match history moved to matchHistory.js
      if (window.matchHistoryUtils) {
        window.matchHistoryUtils.loadMatchHistory();
      }
      initializePerformanceChart();
    }
  }, 5 * 60 * 1000);
}

function setupDashboardEventListeners() {
  // Update visibility change handler to include dashboard data
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      // Match history moved to matchHistory.js
      if (window.matchHistoryUtils) {
        window.matchHistoryUtils.loadMatchHistory();
      }
      initializePerformanceChart();
      window.friendsUtils.loadFriendsData(1,6,true);    
    }
  });

  // Update online status handler to refresh dashboard data
  window.addEventListener("online", () => {
    // Match history moved to matchHistory.js
    if (window.matchHistoryUtils) {
      window.matchHistoryUtils.loadMatchHistory();
    }
    initializePerformanceChart();
  });
}

function initializeDashboard() {
  if (window.matchHistoryUtils) {
    window.matchHistoryUtils.loadMatchHistory();
  }
  initializePerformanceChart();
  setupDashboardEventListeners();
  startDashboardAutoRefresh();
}

window.dashboardUtils = {
  displayUserStats,
  initializePerformanceChart,
  updatePerformanceOverviewText,
  startDashboardAutoRefresh,
  setupDashboardEventListeners,
  initializeDashboard,
};