document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("login-form");
  const loginBtn = document.getElementById("login-btn");
  const btnText = loginBtn.querySelector(".btn-text");
  const btnLoader = loginBtn.querySelector(".btn-loader");

  checkIfLoggedIn();

  document.querySelectorAll(".toggle-password").forEach((element) => {
    togglePassword(element);
  });

  // Form submission
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Show loading state
    setButtonLoading(true);
    clearAlerts();

    // Get form data
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // Validate form
    const validationErrors = validateLoginForm(data);
    if (validationErrors.length > 0) {
      showAlert(validationErrors[0], "error");
      setButtonLoading(false);
      return;
    }

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        showAlert("Login successfully! Redirecting...", "success");

        // Store in localStorage for development
        localStorage.setItem("user", JSON.stringify(result.user));

        // Redirect after short delay
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      } else {
        showAlert(result.message, "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      showAlert(
        "Network error. Please check your connection and try again.",
        "error"
      );
    } finally {
      setButtonLoading(false);
    }
  });

  // Helper functions
  function setButtonLoading(loading) {
    loginBtn.disabled = loading;
    if (loading) {
      btnText.style.display = "none";
      btnLoader.style.display = "inline-block";
    } else {
      btnText.style.display = "inline-block";
      btnLoader.style.display = "none";
    }
  }

  function validateLoginForm(data) {
    const errors = [];

    if (!data.email || data.email.trim().length === 0) {
      errors.push("Email is required");
    }

    if (!data.password || data.password.length === 0) {
      errors.push("Password is required");
    }

    return errors;
  }
});

async function checkIfLoggedIn() {
  try {
    const response = await fetch("/auth/me", {
      credentials: "include", // Send cookies
    });
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        // User is already logged in, redirect
        console.log("User already logged in, redirecting to dashboard");
        window.location.href = "/dashboard";
        return;
      }
    }

    // Handle 401 (not logged in) - this is expected
    if (response.status === 401) {
      console.log("User not authenticated - this is expected on Login page");
      return; // Continue with signup page
    }

    // Handle other errors
    console.log("Auth check failed with status:", response.status);
  } catch (error) {
    console.log("User not authenticated");
  }
}

function showAlert(message, type = "info") {
  const alertDiv = document.getElementById("alert");
  if (alertDiv) {
    alertDiv.className = `alert ${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = "block";
    alertDiv.style.padding = "10px";
    alertDiv.style.marginBottom = "15px";
    alertDiv.style.borderRadius = "5px";

    if (type === "success") {
      alertDiv.style.backgroundColor = "#d4edda";
      alertDiv.style.color = "#155724";
      alertDiv.style.border = "1px solid #c3e6cb";
    } else if (type === "error") {
      alertDiv.style.backgroundColor = "#f8d7da";
      alertDiv.style.color = "#721c24";
      alertDiv.style.border = "1px solid #f5c6cb";
    }

    if (type === "success") {
      setTimeout(() => {
        alertDiv.style.display = "none";
      }, 5000);
    }
  }
}

function clearAlerts() {
  const alertDiv = document.getElementById("alert");
  if (alertDiv) {
    alertDiv.style.display = "none";
    alertDiv.textContent = "";
  }
}

function togglePassword(element) {
  element.addEventListener("click", () => {
    element.classList.toggle("fa-eye-slash");
    element.classList.toggle("fa-eye");
    if (element.classList.contains("fa-eye-slash")) {
      document.getElementById(element.getAttribute("data-target")).type =
        "text";
    } else {
      document.getElementById(element.getAttribute("data-target")).type =
        "password";
    }
  });
}
