document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const signupBtn = document.querySelector(".send-form");
  const btnText = signupBtn.querySelector(".btn-text");
  const btnLoader = signupBtn.querySelector(".btn-loader");

  const passwordInput = document.getElementById("password");
  const passwordStrengthDiv = document.getElementById("password-strength");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const passwordMatchDiv = document.getElementById("password-match");

  // Get strength elements
  const strengthText = document.querySelector(".strength-text");
  const strengthIcon = document.querySelector(".strength-icon");
  const strengthBars = document.querySelectorAll(".strength-bar");

  checkIfLoggedIn();

  document.querySelectorAll(".toggle-password").forEach((element) => {
    togglePassword(element);
  });

  // Enhanced password strength checker
  passwordInput.addEventListener("input", function () {
    const password = this.value;
    const strength = strengthPasswordChecker(password);

    if (passwordStrengthDiv && strengthText && strengthIcon) {
      if (password.length > 0) {
        // Update content
        strengthIcon.textContent = strength.icon;
        strengthText.textContent = strength.text;

        // Update classes with smooth transition
        document.querySelector(".password-group .toggle-password").style.top =
          "33%";
        document.querySelector(
          ".password-group .toggle-password"
        ).style.transition = "none";
        passwordStrengthDiv.className = `password-strength show ${strength.class}`;
        // Update progress bars with staggered animation
        updateStrengthBars(strength.score, strengthBars);
      } else {
        passwordStrengthDiv.classList.remove("show");
        document.querySelector(".password-group .toggle-password").style.top =
          "40%";

        strengthBars.forEach((bar) => bar.classList.remove("active"));
      }
    }

    // Check password match when confirm password has value
    if (confirmPasswordInput.value) {
      checkPasswordMatch();
    }
  });

  // Add blur event listener to hide password strength when unfocused
  passwordInput.addEventListener("blur", function () {
    if (passwordStrengthDiv) {
      passwordStrengthDiv.classList.remove("show");
      document.querySelector(".password-group .toggle-password").style.top =
        "40%";
      strengthBars.forEach((bar) => bar.classList.remove("active"));
    }
  });

  // Show password strength again when focused (if password has content)
  passwordInput.addEventListener("focus", function () {
    const password = this.value;
    if (password.length > 0 && passwordStrengthDiv) {
      const strength = strengthPasswordChecker(password);

      // Update content
      strengthIcon.textContent = strength.icon;
      strengthText.textContent = strength.text;

      // Show with current strength
      document.querySelector(".password-group .toggle-password").style.top =
        "33%";
      passwordStrengthDiv.className = `password-strength show ${strength.class}`;
      updateStrengthBars(strength.score, strengthBars);
    }
  });

  // Password confirmation checker
  confirmPasswordInput.addEventListener("input", checkPasswordMatch);

  function checkPasswordMatch() {
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (confirmPassword.length > 0) {
      if (password === confirmPassword) {
        passwordMatchDiv.style.display = "block";
        passwordMatchDiv.className = "password-match match";
        passwordMatchDiv.innerHTML =
          '<i class="fa-solid fa-check"></i> Passwords match';
      } else {
        passwordMatchDiv.style.display = "block";
        passwordMatchDiv.className = "password-match no-match";
        passwordMatchDiv.innerHTML =
          '<i class="fa-solid fa-times"></i> Passwords do not match';
      }
    } else {
      passwordMatchDiv.style.display = "none";
    }
  }

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    setButtonLoading(true);
    clearAlerts();

    // Get form data
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // Validate form
    const validationErrors = validateSignupForm(data);
    if (validationErrors.length > 0) {
      showAlert(validationErrors[0], "error");
      setButtonLoading(false);
      return;
    }
    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        showAlert("Account created successfully! Redirecting...", "success");

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
      console.error("Signup error:", error);
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
    signupBtn.disabled = loading;
    if (loading) {
      btnText.style.display = "none";
      btnLoader.style.display = "inline-block";
    } else {
      btnText.style.display = "inline-block";
      btnLoader.style.display = "none";
    }
  }

  function validateSignupForm(data) {
    const errors = [];

    // Username validation
    if (!data.username || data.username.trim().length === 0) {
      errors.push("Username is required");
    } else if (data.username.length < 3) {
      errors.push("Username must be at least 3 characters");
    } else if (data.username.length > 20) {
      errors.push("Username must be less than 20 characters");
    } else if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
      errors.push(
        "Username can only contain letters, numbers, and underscores"
      );
    }

    // Email validation
    if (!data.email || data.email.trim().length === 0) {
      errors.push("Email is required");
    } else if (!isValidEmail(data.email)) {
      errors.push("Please enter a valid email address");
    }

    // Password validation
    if (!data.password || data.password.length === 0) {
      errors.push("Password is required");
    } else if (data.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }

    // Confirm password validation
    if (!data.confirmPassword || data.confirmPassword.length === 0) {
      errors.push("Please confirm your password");
    } else if (data.password !== data.confirmPassword) {
      errors.push("Passwords do not match");
    }

    return errors;
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
      console.log("User not authenticated - this is expected on signup page");
      return; // Continue with signup page
    }

    // Handle other errors
    console.log("Auth check failed with status:", response.status);
  } catch (error) {
    console.log("User not authenticated");
  }
}
// Utility functions
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

// Enhanced password strength checker
function strengthPasswordChecker(password) {
  if (!password || password.length === 0) {
    return { class: "", text: "", icon: "", score: 0 };
  }

  let score = 0;

  // Length scoring (more granular)
  if (password.length >= 12) score += 2;
  else if (password.length >= 8) score += 1;

  // Character variety
  if (password.match(/[a-z]/)) score += 1;
  if (password.match(/[A-Z]/)) score += 1;
  if (password.match(/[0-9]/)) score += 1;
  if (password.match(/[^a-zA-Z0-9]/)) score += 1;

  // Bonus for very long passwords
  if (password.length >= 16) score += 1;

  // Determine strength level with icons
  if (score <= 2) {
    return {
      class: "very-weak",
      text: "Very Weak",
      icon: "⚠️",
      score: Math.max(score, 1),
    };
  } else if (score <= 3) {
    return {
      class: "weak",
      text: "Weak",
      icon: "🔓",
      score: score,
    };
  } else if (score <= 4) {
    return {
      class: "medium",
      text: "Medium",
      icon: "🔒",
      score: score,
    };
  } else if (score <= 5) {
    return {
      class: "strong",
      text: "Strong",
      icon: "💪",
      score: score,
    };
  } else {
    return {
      class: "very-strong",
      text: "Very Strong",
      icon: "🛡️",
      score: Math.min(score, 5),
    };
  }
}

// Update strength bars with staggered animation
function updateStrengthBars(score, strengthBars) {
  strengthBars.forEach((bar, index) => {
    setTimeout(() => {
      if (index < score) {
        bar.classList.add("active");
      } else {
        bar.classList.remove("active");
      }
    }, index * 50); // Faster stagger for smaller form
  });
}
