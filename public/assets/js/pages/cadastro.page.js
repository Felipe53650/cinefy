const registerForm = document.getElementById("registerForm");
const registerFeedback = document.getElementById("registerFeedback");
const usernameInput = document.getElementById("username");
const usernameFeedback = document.getElementById("usernameFeedback");
const usernameSuggestions = document.getElementById("usernameSuggestions");
const submitButton = registerForm ? registerForm.querySelector('button[type="submit"]') : null;

let usernameCheckTimer = null;
let usernameRequestToken = 0;
let lastUsernameAvailability = null;

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const icon = button.querySelector(".material-symbols-outlined");
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    icon.textContent = nextType === "password" ? "visibility_off" : "visibility";
  });
});

if (usernameInput) {
  usernameInput.addEventListener("input", handleUsernameInput);
  usernameInput.addEventListener("blur", () => {
    if (!usernameInput.value.trim()) {
      hideUsernameFeedback();
      return;
    }

    scheduleUsernameAvailabilityCheck({ immediate: true });
  });
}

if (usernameSuggestions) {
  usernameSuggestions.addEventListener("click", handleUsernameSuggestionClick);
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  registerFeedback.classList.add("hidden");

  const username = usernameInput.value;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    registerFeedback.textContent = "As senhas precisam ser iguais.";
    registerFeedback.classList.remove("hidden");
    return;
  }

  const usernameValidation = validateUsernameLocally(username);
  if (!usernameValidation.valid) {
    applyUsernameFeedback("unavailable", usernameValidation.message);
    return;
  }

  const availability = await resolveUsernameAvailability(username, { force: true });
  if (!availability.available) {
    applyUsernameFeedback("unavailable", availability.message);
    return;
  }

  setRegisterLoading(true);

  try {
    await window.register(usernameValidation.sanitized, email, password);
  } catch (error) {
    registerFeedback.textContent = error.message || "Nao foi possivel criar sua conta agora.";
    registerFeedback.classList.remove("hidden");
  } finally {
    setRegisterLoading(false);
  }
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", async () => {
    registerFeedback.classList.add("hidden");

    try {
      await window.loginWithProvider(button.dataset.provider);
    } catch (error) {
      registerFeedback.textContent = error.message || "Nao foi possivel autenticar com esse provedor.";
      registerFeedback.classList.remove("hidden");
    }
  });
});

function handleUsernameInput() {
  registerFeedback.classList.add("hidden");
  const rawValue = usernameInput.value;
  const sanitized = sanitizeUsernameValue(rawValue);

  if (sanitized !== rawValue) {
    usernameInput.value = sanitized;
  }

  if (!sanitized) {
    hideUsernameFeedback();
    renderUsernameSuggestions([]);
    return;
  }

  const validation = validateUsernameLocally(sanitized);
  if (!validation.valid) {
    applyUsernameFeedback("unavailable", validation.message);
    renderUsernameSuggestions([]);
    return;
  }

  scheduleUsernameAvailabilityCheck();
}

function sanitizeUsernameValue(value) {
  if (window.CinefyStore && typeof window.CinefyStore.sanitizeUsername === "function") {
    return window.CinefyStore.sanitizeUsername(value);
  }

  return String(value || "").trim().slice(0, 24);
}

function validateUsernameLocally(value) {
  if (typeof window.validateUsernameCandidate === "function") {
    return window.validateUsernameCandidate(value);
  }

  const sanitized = sanitizeUsernameValue(value);
  if (!sanitized) {
    return {
      valid: false,
      sanitized,
      message: "Escolha um nome de usuario para continuar."
    };
  }

  return {
    valid: sanitized.length >= 3,
    sanitized,
    message: sanitized.length >= 3
      ? "Nome de usuario disponivel."
      : "Use pelo menos 3 caracteres."
  };
}

function scheduleUsernameAvailabilityCheck({ immediate = false } = {}) {
  window.clearTimeout(usernameCheckTimer);

  const validation = validateUsernameLocally(usernameInput.value);
  if (!validation.valid) {
    applyUsernameFeedback("unavailable", validation.message);
    renderUsernameSuggestions([]);
    return;
  }

  applyUsernameFeedback("checking", "Verificando disponibilidade...");

  if (immediate) {
    resolveUsernameAvailability(validation.sanitized);
    return;
  }

  usernameCheckTimer = window.setTimeout(() => {
    resolveUsernameAvailability(validation.sanitized);
  }, 260);
}

async function resolveUsernameAvailability(value, { force = false } = {}) {
  const validation = validateUsernameLocally(value);
  if (!validation.valid) {
    applyUsernameFeedback("unavailable", validation.message);
    renderUsernameSuggestions([]);
    return {
      available: false,
      ...validation
    };
  }

  if (!force && lastUsernameAvailability && lastUsernameAvailability.sanitized === validation.sanitized) {
    applyUsernameFeedback(lastUsernameAvailability.available ? "available" : "unavailable", lastUsernameAvailability.message);
    maybeRenderUsernameSuggestions(lastUsernameAvailability, validation.sanitized);
    return lastUsernameAvailability;
  }

  const token = usernameRequestToken + 1;
  usernameRequestToken = token;

  try {
    const availability = typeof window.checkUsernameAvailability === "function"
      ? await window.checkUsernameAvailability(validation.sanitized)
      : { available: true, sanitized: validation.sanitized, message: "Nome de usuario disponivel." };

    if (token !== usernameRequestToken) {
      return availability;
    }

    lastUsernameAvailability = availability;
    applyUsernameFeedback(availability.available ? "available" : "unavailable", availability.message);
    await maybeRenderUsernameSuggestions(availability, validation.sanitized);
    return availability;
  } catch (error) {
    if (token !== usernameRequestToken) {
      throw error;
    }

    const fallback = {
      available: false,
      sanitized: validation.sanitized,
      message: "Nao foi possivel verificar esse nome agora."
    };
    lastUsernameAvailability = fallback;
    applyUsernameFeedback("unavailable", fallback.message);
    renderUsernameSuggestions([]);
    return fallback;
  }
}

function applyUsernameFeedback(state, message) {
  if (!usernameFeedback) return;
  usernameFeedback.dataset.state = state;
  usernameFeedback.textContent = message;
  usernameFeedback.classList.remove("hidden");
}

function hideUsernameFeedback() {
  if (!usernameFeedback) return;
  usernameFeedback.textContent = "";
  usernameFeedback.dataset.state = "";
  usernameFeedback.classList.add("hidden");
}

async function maybeRenderUsernameSuggestions(availability, seedValue) {
  if (!availability || availability.available || availability.reason !== "taken") {
    renderUsernameSuggestions([]);
    return;
  }

  const currentToken = usernameRequestToken;
  const suggestions = typeof window.getUsernameSuggestions === "function"
    ? await window.getUsernameSuggestions(seedValue)
    : [];

  if (currentToken !== usernameRequestToken) {
    return;
  }

  renderUsernameSuggestions(suggestions);
}

function renderUsernameSuggestions(suggestions) {
  if (!usernameSuggestions) return;

  if (!Array.isArray(suggestions) || !suggestions.length) {
    usernameSuggestions.innerHTML = "";
    usernameSuggestions.classList.add("hidden");
    return;
  }

  usernameSuggestions.innerHTML = suggestions.map((suggestion) => `
    <button class="username-suggestion-chip" data-username-suggestion="${escapeAttribute(suggestion)}" type="button">
      @${escapeHtml(suggestion)}
    </button>
  `).join("");
  usernameSuggestions.classList.remove("hidden");
}

function handleUsernameSuggestionClick(event) {
  const button = event.target.closest("[data-username-suggestion]");
  if (!button) return;

  const suggestion = button.dataset.usernameSuggestion || "";
  usernameInput.value = suggestion;
  lastUsernameAvailability = null;
  handleUsernameInput();
  usernameInput.focus();
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setRegisterLoading(isLoading) {
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Criando conta..." : "Criar Conta";
}
