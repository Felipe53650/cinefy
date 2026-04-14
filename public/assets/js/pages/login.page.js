const loginForm = document.getElementById("loginForm");
const loginFeedback = document.getElementById("loginFeedback");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const passwordInput = document.getElementById("password");
const capsLockIndicator = document.getElementById("capsLockIndicator");

function showFeedback(message, type = "error") {
  loginFeedback.textContent = message;
  loginFeedback.classList.remove("hidden", "is-error", "is-success");

  if (type === "success") {
    loginFeedback.classList.add("is-success");
  } else {
    loginFeedback.classList.add("is-error");
  }
}

if (typeof window.consumeAuthFlash === "function") {
  const authFlash = window.consumeAuthFlash();
  if (authFlash && authFlash.message) {
    showFeedback(authFlash.message, authFlash.type || "success");
  }
}

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const icon = button.querySelector(".material-symbols-outlined");
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    icon.textContent = nextType === "password" ? "visibility_off" : "visibility";
  });
});

function updateCapsLockIndicator(event) {
  if (!capsLockIndicator) return;

  const isCapsLockOn = Boolean(event && typeof event.getModifierState === "function" && event.getModifierState("CapsLock"));
  capsLockIndicator.classList.toggle("hidden", !isCapsLockOn);
}

if (passwordInput) {
  ["keydown", "keyup"].forEach((eventName) => {
    passwordInput.addEventListener(eventName, updateCapsLockIndicator);
  });

  passwordInput.addEventListener("blur", () => {
    capsLockIndicator.classList.add("hidden");
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginFeedback.classList.add("hidden");

  try {
    await window.login(
      document.getElementById("email").value.trim(),
      document.getElementById("password").value
    );
  } catch (error) {
    showFeedback(error.message || "Nao foi possivel entrar agora.");
  }
});

forgotPasswordButton.addEventListener("click", async () => {
  loginFeedback.classList.add("hidden");

  try {
    await window.resetPassword(document.getElementById("email").value.trim());
    showFeedback("Enviamos um e-mail com instrucoes para redefinir sua senha.", "success");
  } catch (error) {
    showFeedback(error.message || "Nao foi possivel iniciar a recuperacao de senha.");
  }
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", async () => {
    loginFeedback.classList.add("hidden");

    try {
      await window.loginWithProvider(button.dataset.provider);
    } catch (error) {
      showFeedback(error.message || "Nao foi possivel autenticar com esse provedor.");
    }
  });
});
