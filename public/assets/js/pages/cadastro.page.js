const registerForm = document.getElementById("registerForm");
    const registerFeedback = document.getElementById("registerFeedback");

    document.querySelectorAll(".toggle-password").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        const icon = button.querySelector(".material-symbols-outlined");
        const nextType = input.type === "password" ? "text" : "password";
        input.type = nextType;
        icon.textContent = nextType === "password" ? "visibility_off" : "visibility";
      });
    });

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      registerFeedback.classList.add("hidden");

      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (password !== confirmPassword) {
        registerFeedback.textContent = "As senhas precisam ser iguais.";
        registerFeedback.classList.remove("hidden");
        return;
      }

      try {
        await window.register(name, email, password);
      } catch (error) {
        registerFeedback.textContent = error.message || "Nao foi possivel criar sua conta agora.";
        registerFeedback.classList.remove("hidden");
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

