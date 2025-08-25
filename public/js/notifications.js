function setupNotificationsEventListeners() {
  // Setup search input listener
  const searchInput = document.querySelector(".search-notifications");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      handleSearchInput(e.target.value);
    });
  }

  // Setup type filter dropdown functionality
  if (document.getElementById("typeDropdownBtn")) {
    document
      .getElementById("typeDropdownBtn")
      .addEventListener("click", function () {
        document.getElementById("typeDropdownMenu").classList.toggle("show");
        // Close sort dropdown if open
        document.getElementById("sortDropdownMenu").classList.remove("show");
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
        handleTypeFilter(e.target.value);
      });
    });
  }

  // Setup sort dropdown functionality
  if (document.getElementById("sortDropdownBtn")) {
    document
      .getElementById("sortDropdownBtn")
      .addEventListener("click", function () {
        document.getElementById("sortDropdownMenu").classList.toggle("show");
        // Close type dropdown if open
        document.getElementById("typeDropdownMenu").classList.remove("show");
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
        handleSortFilter(e.target.value);
      });
    });
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
}

function handleSearchInput(value) {
  console.log("Searching for:", value);
}

function handleTypeFilter(value) {
  console.log("Filtering by type:", value);
}

function handleSortFilter(value) {
  console.log("Sorting by:", value);
}

document.addEventListener("DOMContentLoaded", function () {
  setupNotificationsEventListeners();
});
