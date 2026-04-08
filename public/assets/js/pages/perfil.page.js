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
      const locationSuggestionsPanel = document.getElementById("locationSuggestionsPanel");
      const locationSuggestionsList = document.getElementById("locationSuggestionsList");
      const locationSuggestionsHint = document.getElementById("locationSuggestionsHint");
      const availableThemes = themeManager && typeof themeManager.getThemes === "function"
        ? themeManager.getThemes()
        : [];
      const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
      const brazilMunicipalities = Array.isArray(window.CINEFY_BRAZIL_MUNICIPALITIES)
        ? window.CINEFY_BRAZIL_MUNICIPALITIES
        : [];
      const preparedMunicipalities = brazilMunicipalities.map(prepareMunicipality);
      let activeLocationIndex = -1;
      let visibleLocationSuggestions = [];

      profile.theme = resolveTheme(profile.theme);

      hydrateForm();
      renderProfile();

      profileForm.addEventListener("submit", handleProfileSubmit);
      avatarInput.addEventListener("change", handleAvatarChange);
      removeAvatarButton.addEventListener("click", removeAvatar);
      logoutButton.addEventListener("click", handleLogout);
      locationInput.addEventListener("input", handleLocationInput);
      locationInput.addEventListener("focus", handleLocationFocus);
      locationInput.addEventListener("keydown", handleLocationKeydown);
      locationInput.addEventListener("blur", handleLocationBlur);
      locationSuggestionsList.addEventListener("mousedown", handleLocationOptionMouseDown);
      locationSuggestionsList.addEventListener("click", handleLocationOptionClick);
      document.addEventListener("click", handleLocationOutsideClick);
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
        const friendCountStat = document.getElementById("friendCountStat");
        document.getElementById("profileDisplayName").textContent = profile.displayName;
        document.getElementById("profileUsername").textContent = `@${profile.username}`;
        document.getElementById("profileBioText").textContent = profile.bio;
        document.getElementById("profileLocation").textContent = profile.location;
        document.getElementById("friendCountBadge").textContent = friends.length;
        if (friendCountStat) {
          friendCountStat.textContent = friends.length;
        }
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
          profile.location = canonicalizeLocation(document.getElementById("locationInput").value.trim());
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
          if (!allowedImageTypes.has(file.type)) {
            throw new Error("Selecione uma imagem PNG, JPG ou WEBP valida.");
          }
          if (file.size > 5 * 1024 * 1024) {
            throw new Error("A imagem precisa ter no maximo 5 MB.");
          }
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
            feedback.textContent = "Foto atualizada localmente. O upload em nuvem falhou nesta tentativa, mas o perfil foi preservado.";
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

      function prepareMunicipality(entry) {
        const city = String(entry.city || "").trim();
        const state = String(entry.state || "").trim();
        const stateName = String(entry.stateName || "").trim();
        const label = String(entry.label || `${city} - ${state}, BR`).trim();
        const normalizedCity = normalizeText(city);
        const normalizedState = normalizeText(state);
        const normalizedStateName = normalizeText(stateName);
        const normalizedLabel = normalizeText(label);

        return {
          ...entry,
          city,
          state,
          stateName,
          label,
          normalizedCity,
          normalizedState,
          normalizedStateName,
          normalizedLabel,
          tokens: normalizedCity.split(/\s+/).filter(Boolean)
        };
      }

      function handleLocationInput() {
        activeLocationIndex = -1;
        updateLocationSuggestions(locationInput.value, { openPanel: true });
      }

      function handleLocationFocus() {
        updateLocationSuggestions(locationInput.value, { openPanel: true });
      }

      function handleLocationBlur() {
        window.setTimeout(() => {
          setLocationPanelVisibility(false);
          const canonicalLocation = canonicalizeLocation(locationInput.value);
          if (canonicalLocation !== locationInput.value.trim()) {
            locationInput.value = canonicalLocation;
          }
        }, 140);
      }

      function handleLocationOutsideClick(event) {
        if (!event.target.closest(".profile-location-shell")) {
          setLocationPanelVisibility(false);
        }
      }

      function handleLocationOptionMouseDown(event) {
        const option = event.target.closest("[data-location-index]");
        if (option) {
          event.preventDefault();
        }
      }

      function handleLocationOptionClick(event) {
        const option = event.target.closest("[data-location-index]");
        if (!option) return;

        const index = Number(option.dataset.locationIndex);
        selectLocationSuggestion(index);
      }

      function handleLocationKeydown(event) {
        if (!visibleLocationSuggestions.length && event.key !== "Escape") {
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          activeLocationIndex = Math.min(activeLocationIndex + 1, visibleLocationSuggestions.length - 1);
          renderLocationSuggestions();
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          activeLocationIndex = Math.max(activeLocationIndex - 1, 0);
          renderLocationSuggestions();
          return;
        }

        if (event.key === "Enter" && activeLocationIndex >= 0) {
          event.preventDefault();
          selectLocationSuggestion(activeLocationIndex);
          return;
        }

        if (event.key === "Escape") {
          setLocationPanelVisibility(false);
        }
      }

      function updateLocationSuggestions(query, options = {}) {
        const normalizedQuery = normalizeText(query);
        const shouldOpen = options.openPanel !== false;

        if (!normalizedQuery) {
          visibleLocationSuggestions = [];
          activeLocationIndex = -1;
          renderLocationSuggestions("Digite pelo menos 2 letras para buscar entre os municipios.");
          setLocationPanelVisibility(false);
          return;
        }

        if (normalizedQuery.length < 2) {
          visibleLocationSuggestions = [];
          activeLocationIndex = -1;
          renderLocationSuggestions("Continue digitando para refinar os municipios.");
          setLocationPanelVisibility(shouldOpen);
          return;
        }

        visibleLocationSuggestions = searchMunicipalities(normalizedQuery).slice(0, 8);
        activeLocationIndex = visibleLocationSuggestions.length ? 0 : -1;
        renderLocationSuggestions();
        setLocationPanelVisibility(shouldOpen);
      }

      function searchMunicipalities(normalizedQuery) {
        const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

        return preparedMunicipalities
          .map((entry) => ({
            entry,
            score: scoreMunicipality(entry, normalizedQuery, queryTokens)
          }))
          .filter((item) => item.score > 0)
          .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score;
            return left.entry.label.localeCompare(right.entry.label, "pt-BR");
          })
          .map((item) => item.entry);
      }

      function scoreMunicipality(entry, normalizedQuery, queryTokens) {
        let score = 0;

        if (entry.normalizedLabel === normalizedQuery) score += 1200;
        if (entry.normalizedCity === normalizedQuery) score += 1100;
        if (`${entry.normalizedCity} ${entry.normalizedState}` === normalizedQuery) score += 1080;
        if (`${entry.normalizedCity} ${entry.normalizedStateName}` === normalizedQuery) score += 1060;

        if (queryTokens.length === 1) {
          const token = queryTokens[0];

          if (entry.normalizedCity.startsWith(token)) score += 320;
          if (entry.tokens.some((candidate) => candidate.startsWith(token))) score += 180;
          if (entry.normalizedState === token) score += 150;
          if (entry.normalizedStateName.startsWith(token)) score += 140;

          if (token.length >= 3 && entry.normalizedCity.includes(token)) score += 70;
          if (token.length >= 4 && entry.normalizedLabel.includes(token)) score += 25;
        } else {
          const cityStartsWithAll = queryTokens.every((token) => entry.tokens.some((candidate) => candidate.startsWith(token)));
          const cityContainsAll = queryTokens.every((token) => entry.normalizedCity.includes(token));
          const labelContainsAll = queryTokens.every((token) => entry.normalizedLabel.includes(token));
          const stateMatches = queryTokens.some((token) => token === entry.normalizedState || entry.normalizedStateName.startsWith(token));

          if (cityStartsWithAll) score += 360;
          if (cityContainsAll) score += 220;
          if (labelContainsAll) score += 110;
          if (stateMatches) score += 80;
        }

        if (entry.tokens[0] && queryTokens[0] && entry.tokens[0].startsWith(queryTokens[0])) {
          score += 40;
        }

        return score;
      }

      function renderLocationSuggestions(customHint) {
        locationSuggestionsHint.textContent = customHint || "Busque por municipio ou UF.";

        if (!visibleLocationSuggestions.length) {
          locationSuggestionsList.innerHTML = '<div class="profile-location-empty">Nenhum municipio encontrado com esse criterio.</div>';
          locationInput.setAttribute("aria-expanded", locationSuggestionsPanel.classList.contains("hidden") ? "false" : "true");
          locationInput.removeAttribute("aria-activedescendant");
          return;
        }

        locationSuggestionsList.innerHTML = visibleLocationSuggestions.map((item, index) => `
          <button aria-selected="${index === activeLocationIndex ? "true" : "false"}" class="profile-location-option" data-active="${index === activeLocationIndex ? "true" : "false"}" data-location-index="${index}" id="location-option-${index}" role="option" type="button">
            <span class="profile-location-option__copy">
              <span class="profile-location-option__city">${escapeHtml(item.city)}</span>
              <span class="profile-location-option__meta">${escapeHtml(item.stateName)} • ${escapeHtml(item.label)}</span>
            </span>
            <span class="profile-location-option__uf">${escapeHtml(item.state)}</span>
          </button>
        `).join("");

        if (activeLocationIndex >= 0) {
          locationInput.setAttribute("aria-activedescendant", `location-option-${activeLocationIndex}`);
        } else {
          locationInput.removeAttribute("aria-activedescendant");
        }
      }

      function selectLocationSuggestion(index) {
        const selected = visibleLocationSuggestions[index];
        if (!selected) return;

        locationInput.value = selected.label;
        setLocationPanelVisibility(false);
        locationInput.focus();
      }

      function setLocationPanelVisibility(isVisible) {
        locationSuggestionsPanel.classList.toggle("hidden", !isVisible);
        locationInput.setAttribute("aria-expanded", isVisible ? "true" : "false");
        if (!isVisible) {
          locationInput.removeAttribute("aria-activedescendant");
        }
      }

      function canonicalizeLocation(value) {
        const normalizedValue = normalizeText(value);
        if (!normalizedValue || normalizedValue.length < 2) {
          return value;
        }

        const candidates = searchMunicipalities(normalizedValue);
        if (!candidates.length) {
          return value;
        }

        const best = candidates[0];
        const exactEnough = best.normalizedCity === normalizedValue
          || best.normalizedLabel === normalizedValue
          || `${best.normalizedCity} ${best.normalizedState}` === normalizedValue
          || `${best.normalizedCity} ${best.normalizedStateName}` === normalizedValue;

        return exactEnough ? best.label : value;
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

        if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
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

