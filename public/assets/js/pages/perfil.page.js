const store = window.CinefyStore;
      const themeManager = window.CinefyTheme || null;
      const defaultAvatar = store.defaultProfile.avatar;
      let profile = store.loadProfile();
      let friends = store.loadFriends();

      const avatarPreview = document.getElementById("profileAvatarPreview");
      const profileForm = document.getElementById("profileForm");
      const avatarInput = document.getElementById("profileAvatarInput");
      const removeAvatarButton = document.getElementById("removeAvatarButton");
      const logoutButton = document.getElementById("logoutButton");
      const feedback = document.getElementById("profileFeedback");
      const themeSelectorGrid = document.getElementById("themeSelectorGrid");
      const themeFeedback = document.getElementById("themeFeedback");
      const locationInput = document.getElementById("locationInput");
      const locationSuggestions = document.getElementById("brazilLocationSuggestions");
      const availableThemes = themeManager && typeof themeManager.getThemes === "function"
        ? themeManager.getThemes()
        : [];
      const brazilLocations = [
        "Aracaju - SE, BR",
        "Belem - PA, BR",
        "Belo Horizonte - MG, BR",
        "Boa Vista - RR, BR",
        "Brasilia - DF, BR",
        "Campinas - SP, BR",
        "Campo Grande - MS, BR",
        "Curitiba - PR, BR",
        "Cuiaba - MT, BR",
        "Florianopolis - SC, BR",
        "Fortaleza - CE, BR",
        "Goiania - GO, BR",
        "Joao Pessoa - PB, BR",
        "Macapa - AP, BR",
        "Maceio - AL, BR",
        "Manaus - AM, BR",
        "Natal - RN, BR",
        "Palmas - TO, BR",
        "Porto Alegre - RS, BR",
        "Porto Velho - RO, BR",
        "Recife - PE, BR",
        "Rio Branco - AC, BR",
        "Rio de Janeiro - RJ, BR",
        "Salvador - BA, BR",
        "Santa Cruz do Sul - RS, BR",
        "Santa Maria - RS, BR",
        "Santa Rita - PB, BR",
        "Santo Andre - SP, BR",
        "Santos - SP, BR",
        "Sao Bernardo do Campo - SP, BR",
        "Sao Caetano do Sul - SP, BR",
        "Sao Carlos - SP, BR",
        "Sao Goncalo - RJ, BR",
        "Sao Joao de Meriti - RJ, BR",
        "Sao Jose - SC, BR",
        "Sao Jose dos Campos - SP, BR",
        "Sao Leopoldo - RS, BR",
        "Sao Luis - MA, BR",
        "Sao Luis Gonzaga - RS, BR",
        "Sao Paulo - SP, BR",
        "Sao Vicente - SP, BR",
        "Teresina - PI, BR",
        "Vitoria - ES, BR"
      ];

      profile.theme = resolveTheme(profile.theme);

      hydrateForm();
      renderProfile();
      updateLocationSuggestions(locationInput.value);

      profileForm.addEventListener("submit", handleProfileSubmit);
      avatarInput.addEventListener("change", handleAvatarChange);
      removeAvatarButton.addEventListener("click", removeAvatar);
      logoutButton.addEventListener("click", handleLogout);
      locationInput.addEventListener("input", () => updateLocationSuggestions(locationInput.value));
      locationInput.addEventListener("focus", () => updateLocationSuggestions(locationInput.value));
      if (themeSelectorGrid) {
        themeSelectorGrid.addEventListener("click", handleThemeGridClick);
      }

      function hydrateForm() {
        document.getElementById("displayNameInput").value = profile.displayName;
        document.getElementById("usernameInput").value = profile.username;
        document.getElementById("bioInput").value = profile.bio;
        document.getElementById("locationInput").value = profile.location;
      }

      function renderProfile() {
        friends = store.loadFriends();
        profile.theme = resolveTheme(profile.theme);
        document.getElementById("profileDisplayName").textContent = profile.displayName;
        document.getElementById("profileUsername").textContent = `@${profile.username}`;
        document.getElementById("profileBioText").textContent = profile.bio;
        document.getElementById("profileLocation").textContent = profile.location;
        document.getElementById("friendCountBadge").textContent = friends.length;
        document.getElementById("friendCountStat").textContent = friends.length;
        avatarPreview.src = profile.avatar || defaultAvatar;
        renderFriendPreview();
        renderThemeOptions();
      }

      function renderFriendPreview() {
        const list = document.getElementById("friendPreviewList");
        const emptyState = document.getElementById("emptyFriendPreview");

        if (!friends.length) {
          list.innerHTML = "";
          emptyState.classList.remove("hidden");
          return;
        }

        emptyState.classList.add("hidden");
        list.innerHTML = friends.slice(0, 4).map((friend) => `
          <div class="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <img alt="${escapeAttribute(friend.displayName || friend.name || "Usuario")}" class="w-12 h-12 rounded-2xl object-cover" decoding="async" loading="lazy" src="${escapeAttribute(safeAvatarUrl(friend.avatar))}" />
              <div class="min-w-0">
                <p class="font-bold text-white truncate">${escapeHtml(friend.displayName || friend.name || "Usuario")}</p>
                <p class="text-sm text-zinc-400 truncate">@${escapeHtml(friend.username || "cinefyuser")} • ${escapeHtml(friend.favoriteGenre || "Cinema")}</p>
              </div>
            </div>
            <a class="text-sm font-bold text-red-300 hover:text-red-200 whitespace-nowrap" href="amigos.html">Editar</a>
          </div>
        `).join("");
      }

      async function handleProfileSubmit(event) {
        event.preventDefault();
        try {
          profile.displayName = document.getElementById("displayNameInput").value.trim();
          profile.username = sanitizeUsername(document.getElementById("usernameInput").value);
          profile.bio = document.getElementById("bioInput").value.trim();
          profile.location = document.getElementById("locationInput").value.trim();
          if (typeof window.saveCurrentProfile === "function") {
            await window.saveCurrentProfile(profile);
          } else {
            store.saveProfile(profile);
          }
          renderProfile();
          feedback.textContent = "Perfil atualizado com sucesso.";
        } catch (error) {
          feedback.textContent = error.message || "Nao foi possivel salvar o perfil agora.";
        }
      }

      function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem selecionada."));
          reader.readAsDataURL(file);
        });
      }

      async function handleAvatarChange(event) {
        const [file] = event.target.files;
        if (!file) return;

        try {
          if (window.CinefyStorage && typeof window.CinefyStorage.uploadUserImage === "function") {
            feedback.textContent = "Enviando foto de perfil...";
            profile.avatar = await window.CinefyStorage.uploadUserImage(file, "avatars");
          } else {
            profile.avatar = await readFileAsDataUrl(file);
          }
          if (typeof window.saveCurrentProfile === "function") {
            await window.saveCurrentProfile(profile);
          } else {
            store.saveProfile(profile);
          }
          renderProfile();
          feedback.textContent = "Foto de perfil atualizada.";
        } catch (error) {
          try {
            profile.avatar = await readFileAsDataUrl(file);
            if (typeof window.saveCurrentProfile === "function") {
              await window.saveCurrentProfile(profile);
            } else {
              store.saveProfile(profile);
            }
            renderProfile();
            feedback.textContent = "Foto atualizada localmente. Assim que o Firebase Storage for configurado, o upload em nuvem sera usado.";
          } catch (fallbackError) {
            feedback.textContent = fallbackError.message || error.message || "Nao foi possivel atualizar a foto agora.";
          }
        } finally {
          avatarInput.value = "";
        }
      }

      async function removeAvatar() {
        try {
          profile.avatar = defaultAvatar;
          if (typeof window.saveCurrentProfile === "function") {
            await window.saveCurrentProfile(profile);
          } else {
            store.saveProfile(profile);
          }
          avatarInput.value = "";
          renderProfile();
          feedback.textContent = "Foto de perfil removida.";
        } catch (error) {
          feedback.textContent = error.message || "Nao foi possivel remover a foto agora.";
        }
      }

      function renderThemeOptions() {
        if (!themeSelectorGrid || !availableThemes.length) return;

        themeSelectorGrid.innerHTML = availableThemes.map((theme) => {
          const isActive = theme.id === resolveTheme(profile.theme);
          return `
            <button class="theme-choice" data-active="${isActive ? "true" : "false"}" data-theme-id="${escapeAttribute(theme.id)}" type="button">
              <div class="theme-choice__preview">
                <span class="theme-choice__swatch theme-choice__swatch--accent"></span>
                <span class="theme-choice__swatch theme-choice__swatch--accent-strong"></span>
                <span class="theme-choice__swatch theme-choice__swatch--background"></span>
              </div>
              <div class="theme-choice__label">
                <span>${escapeHtml(theme.label)}</span>
                ${isActive ? '<span class="theme-choice__badge">Ativo</span>' : ""}
              </div>
              <p class="theme-choice__desc">${escapeHtml(theme.description)}</p>
            </button>
          `;
        }).join("");
      }

      async function handleThemeGridClick(event) {
        const button = event.target.closest("[data-theme-id]");
        if (!button) return;

        const nextThemeId = resolveTheme(button.dataset.themeId);
        const selectedTheme = availableThemes.find((theme) => theme.id === nextThemeId);
        const selectedThemeLabel = selectedTheme ? selectedTheme.label : "Tema";

        if (nextThemeId === resolveTheme(profile.theme)) {
          if (themeManager && typeof themeManager.applyTheme === "function") {
            themeManager.applyTheme(nextThemeId);
          }
          themeFeedback.textContent = `O tema "${selectedThemeLabel}" ja esta ativo.`;
          return;
        }

        const previousTheme = resolveTheme(profile.theme);
        profile.theme = nextThemeId;
        renderThemeOptions();

        if (themeManager && typeof themeManager.applyTheme === "function") {
          themeManager.applyTheme(nextThemeId);
        }

        try {
          if (typeof window.saveCurrentProfile === "function") {
            await window.saveCurrentProfile(profile);
          } else {
            store.saveProfile(profile);
          }

          if (themeManager && typeof themeManager.persistTheme === "function") {
            themeManager.persistTheme(nextThemeId);
          }

          renderProfile();
          themeFeedback.textContent = `Tema "${selectedThemeLabel}" aplicado em todo o site.`;
        } catch (error) {
          profile.theme = previousTheme;
          if (themeManager && typeof themeManager.applyTheme === "function") {
            themeManager.applyTheme(previousTheme);
          }
          renderThemeOptions();
          themeFeedback.textContent = error.message || "Nao foi possivel salvar o tema agora.";
        }
      }

      function handleLogout() {
        if (typeof window.logout === "function") {
          window.logout();
          return;
        }

        localStorage.removeItem("cinefy-auth-session");
        localStorage.removeItem(store.PROFILE_KEY);
        localStorage.removeItem(store.FRIENDS_KEY);
        localStorage.removeItem(store.NOTIFICATIONS_KEY);
        localStorage.removeItem(store.REVIEWS_KEY);
        localStorage.removeItem("cinefy-user-list");
        window.location.href = "index.html";
      }

      function sanitizeUsername(value) {
        return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "cinefyuser";
      }

      function resolveTheme(themeId) {
        if (!themeManager || typeof themeManager.resolveTheme !== "function") {
          return themeId || "ember";
        }

        return themeManager.resolveTheme(themeId);
      }

      function updateLocationSuggestions(query) {
        const normalizedQuery = normalizeText(query);
        const matches = brazilLocations.filter((location) => {
          if (!normalizedQuery) return true;
          return normalizeText(location).includes(normalizedQuery);
        }).slice(0, 8);

        locationSuggestions.innerHTML = matches.map((location) => `<option value="${escapeAttribute(location)}"></option>`).join("");
      }

      function normalizeText(value) {
        return String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
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

      function safeAvatarUrl(value) {
        const fallbackAvatar = profile.avatar || defaultAvatar;
        const candidate = String(value || "").trim();
        if (!candidate) return fallbackAvatar;

        if (candidate.startsWith("data:image/") || candidate.startsWith("blob:")) {
          return candidate;
        }

        try {
          const parsedUrl = new URL(candidate, window.location.origin);
          if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
            return parsedUrl.href;
          }
        } catch (error) {
          return fallbackAvatar;
        }

        return fallbackAvatar;
      }

