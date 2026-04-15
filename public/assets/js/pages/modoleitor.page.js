(function () {
  const store = window.CinefyStore;
  const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
  const auth = window.CinefyFirebase ? window.CinefyFirebase.auth : null;
  const params = new URLSearchParams(window.location.search);
  const shareId = params.get("share");
  const defaultPoster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
  const defaultDescription = "Uma lista com filmes que recomendo.";
  const localProfile = store.loadProfile();
  const localListState = store.loadListState();

  let currentShareId = shareId || "";
  let activeOwner = {
    uid: localProfile.uid || "",
    username: localProfile.username || "cinefyuser",
    displayName: localProfile.displayName || "Cinefilo",
    avatar: localProfile.avatar || "/assets/img/logo.png"
  };
  let activeListState = normalizeSharedListState(localListState);
  let activeShareSettings = {
    ownerUid: localProfile.uid || "",
    privacy: "publica",
    shareAccessLevel: "reader",
    shareEditorScope: "link",
    shareReaderOnlyUserIds: []
  };
  let canEditSharedList = false;
  let unsubscribeSharedList = null;

  const readerGrid = document.getElementById("readerGrid");
  const readerTitle = document.getElementById("readerTitle");
  const readerDescription = document.getElementById("readerDescription");
  const readerMovieCount = document.getElementById("readerMovieCount");
  const readerMovieCountInline = document.getElementById("readerMovieCountInline");
  const readerOwnerName = document.getElementById("readerOwnerName");
  const readerOwnerHandle = document.getElementById("readerOwnerHandle");
  const readerOwnerAvatar = document.getElementById("readerOwnerAvatar");
  const readerOwnerLink = document.getElementById("readerOwnerLink");
  const readerStatusValue = document.getElementById("readerStatusValue");
  const readerExperienceCopy = document.getElementById("readerExperienceCopy");
  const readerEditorPanel = document.getElementById("readerEditorPanel");
  const readerSharedMetaForm = document.getElementById("readerSharedMetaForm");
  const readerSharedTitleInput = document.getElementById("readerSharedTitleInput");
  const readerSharedDescriptionInput = document.getElementById("readerSharedDescriptionInput");
  const readerSharedMetaFeedback = document.getElementById("readerSharedMetaFeedback");
  const readerAddMovieForm = document.getElementById("readerAddMovieForm");
  const readerMovieTitleInput = document.getElementById("readerMovieTitleInput");
  const readerMovieGenreInput = document.getElementById("readerMovieGenreInput");
  const readerMovieYearInput = document.getElementById("readerMovieYearInput");
  const readerMovieRatingInput = document.getElementById("readerMovieRatingInput");
  const readerMoviePosterInput = document.getElementById("readerMoviePosterInput");
  const readerMovieNoteInput = document.getElementById("readerMovieNoteInput");
  const readerAddMovieFeedback = document.getElementById("readerAddMovieFeedback");

  if (readerSharedMetaForm) {
    readerSharedMetaForm.addEventListener("submit", handleSharedMetaSubmit);
  }

  if (readerAddMovieForm) {
    readerAddMovieForm.addEventListener("submit", handleAddSharedMovie);
  }

  if (auth && typeof auth.onAuthStateChanged === "function") {
    auth.onAuthStateChanged(() => {
      updateEditAccessState();
      renderReaderMode();
    });
  }

  bootstrapReaderMode();

  function bootstrapReaderMode() {
    if (shareId) {
      if (!firestore) {
        renderUnavailableState("O servico de compartilhamento nao esta disponivel agora.");
        return;
      }

      subscribeToSharedList();
      return;
    }

    updateEditAccessState();
    renderReaderMode();
  }

  function subscribeToSharedList() {
    if (unsubscribeSharedList) {
      unsubscribeSharedList();
    }

    unsubscribeSharedList = firestore.collection("shared_lists").doc(shareId).onSnapshot((snapshot) => {
      if (!snapshot.exists) {
        renderUnavailableState("Essa lista compartilhada nao foi encontrada.");
        return;
      }

      const data = snapshot.data() || {};
      if (data.privacy && data.privacy !== "publica") {
        renderUnavailableState("Essa lista nao esta mais publica.");
        return;
      }

      currentShareId = data.shareId || shareId;
      activeOwner = {
        uid: String(data.ownerUid || ""),
        username: sanitizeText(data.ownerUsername || "cinefyuser", 24) || "cinefyuser",
        displayName: sanitizeText(data.ownerDisplayName || "Cinefilo", 80) || "Cinefilo",
        avatar: safeAvatarUrl(data.ownerAvatar)
      };
      activeListState = normalizeSharedListState({
        title: data.title || "Lista compartilhada",
        description: data.description || defaultDescription,
        movies: Array.isArray(data.movies) ? data.movies : []
      });
      activeShareSettings = {
        ownerUid: String(data.ownerUid || ""),
        privacy: data.privacy === "privada" ? "privada" : "publica",
        shareAccessLevel: data.shareAccessLevel === "editor" ? "editor" : "reader",
        shareEditorScope: data.shareEditorScope === "except_selected" ? "except_selected" : "link",
        shareReaderOnlyUserIds: Array.isArray(data.shareReaderOnlyUserIds) ? data.shareReaderOnlyUserIds.slice(0, 80).map((item) => String(item || "")) : []
      };

      updateEditAccessState();
      renderReaderMode();
    }, (error) => {
      console.error("Erro ao carregar lista compartilhada:", error);
      renderUnavailableState("Nao foi possivel carregar essa lista compartilhada agora.");
    });
  }

  function renderReaderMode() {
    document.title = `Cinefy Club - Lista de @${activeOwner.username || "cinefyuser"}`;
    readerTitle.textContent = shareId
      ? `Voce esta visualizando a lista de @${activeOwner.username || "cinefyuser"}`
      : `Voce esta visualizando a lista de @${activeOwner.username || "cinefyuser"}`;
    readerDescription.textContent = activeListState.description || defaultDescription;
    readerMovieCount.textContent = activeListState.movies.length;
    readerMovieCountInline.textContent = activeListState.movies.length;
    readerOwnerName.textContent = activeOwner.displayName || "Cinefilo";
    readerOwnerHandle.textContent = `@${activeOwner.username || "cinefyuser"}`;
    readerOwnerAvatar.src = safeAvatarUrl(activeOwner.avatar);
    if (readerOwnerLink) {
      readerOwnerLink.href = getPublicProfileHref(activeOwner);
    }

    renderReaderStatus();
    renderEditorPanel();
    renderReaderGrid();
  }

  function renderReaderStatus() {
    const currentUid = getCurrentUid();

    if (!shareId) {
      readerStatusValue.textContent = "Somente leitura";
      readerExperienceCopy.textContent = "Explore a curadoria, abra detalhes e descubra os titulos sem alterar a lista original.";
      return;
    }

    if (activeShareSettings.shareAccessLevel === "editor" && canEditSharedList) {
      readerStatusValue.textContent = "Edicao colaborativa";
      readerExperienceCopy.textContent = "Voce pode ajustar o titulo, a descricao e os filmes desta lista compartilhada. As mudancas aparecem em tempo real para quem estiver no link.";
      return;
    }

    if (activeShareSettings.shareAccessLevel === "editor" && !currentUid) {
      readerStatusValue.textContent = "Entre para editar";
      readerExperienceCopy.textContent = "A lista aceita colaboradores logados. Voce ainda pode explorar o conteudo, mas precisa entrar na conta para editar.";
      return;
    }

    if (activeShareSettings.shareAccessLevel === "editor") {
      readerStatusValue.textContent = "Leitura protegida";
      readerExperienceCopy.textContent = "Essa lista esta em edicao colaborativa, mas seu acesso atual foi mantido em modo leitura pelo dono da lista.";
      return;
    }

    readerStatusValue.textContent = "Somente leitura";
    readerExperienceCopy.textContent = "Explore a curadoria, abra detalhes e descubra os titulos sem alterar a lista original.";
  }

  function renderEditorPanel() {
    if (!readerEditorPanel) return;

    const shouldShow = Boolean(shareId && canEditSharedList);
    readerEditorPanel.classList.toggle("hidden", !shouldShow);

    if (!shouldShow) return;

    readerSharedTitleInput.value = activeListState.title || "Lista compartilhada";
    readerSharedDescriptionInput.value = activeListState.description || defaultDescription;
  }

  function renderReaderGrid() {
    if (!activeListState.movies.length) {
      readerGrid.innerHTML = `
        <div class="reader-empty-state">
          <span class="material-symbols-outlined text-5xl text-red-400">local_movies</span>
          <p class="text-xl font-black text-white">Nenhum filme compartilhado ainda.</p>
          <p class="mt-2 text-zinc-400">Assim que houver filmes publicados nessa lista, eles aparecerao aqui automaticamente.</p>
        </div>
      `;
      return;
    }

    readerGrid.innerHTML = buildReaderGridMarkup(activeListState.movies);
    readerGrid.querySelectorAll("[data-reader-remove]").forEach((button) => {
      button.addEventListener("click", handleRemoveSharedMovie);
    });

    hydrateReaderMovieCertifications().then((hasUpdates) => {
      if (hasUpdates) {
        readerGrid.innerHTML = buildReaderGridMarkup(activeListState.movies);
        readerGrid.querySelectorAll("[data-reader-remove]").forEach((button) => {
          button.addEventListener("click", handleRemoveSharedMovie);
        });
      }
    });
  }

  function buildReaderGridMarkup(movies) {
    return movies.map((movie) => `
      <article class="reader-card group glass-card rounded-3xl transition-all duration-300 hover:-translate-y-1">
        <div class="reader-card__poster">
          <a class="reader-card__poster-link" href="${escapeAttribute(getMovieDetailsHref(movie))}">
            <img alt="${escapeHtml(movie.title)}" decoding="async" loading="lazy" src="${escapeAttribute(safePosterUrl(movie.poster || defaultPoster))}"/>
          </a>
          <div class="reader-card__overlay"></div>
          ${movie.certificationLabel ? `<div class="reader-card__certification">${escapeHtml(movie.certificationLabel)}</div>` : ""}
          <div class="reader-card__rating">
            <span class="material-symbols-outlined fill-icon text-yellow-500 text-sm">star</span>
            <span class="text-sm font-bold">${formatRating(movie.rating)}</span>
          </div>
          <a class="reader-card__cta" href="${escapeAttribute(getMovieDetailsHref(movie))}">
            <span class="material-symbols-outlined text-base">open_in_new</span>
            <span>Ver detalhes</span>
          </a>
        </div>
        <div class="reader-card__body">
          <a class="reader-card__title" href="${escapeAttribute(getMovieDetailsHref(movie))}">${escapeHtml(movie.title)}</a>
          <div class="reader-card__meta">
            <span class="reader-card__pill">${escapeHtml(movie.genre || "Filme")}</span>
            <span class="reader-card__pill">${escapeHtml(String(movie.year || "Sem ano"))}</span>
          </div>
          <p class="reader-card__note line-clamp-3">${escapeHtml(movie.note || "Sem comentario adicional.")}</p>
          ${canEditSharedList ? `
            <div class="reader-card__actions">
              <button class="reader-card__remove" data-reader-remove="${escapeAttribute(String(movie.id || ""))}" type="button">
                <span class="material-symbols-outlined text-base">delete</span>
                <span>Remover</span>
              </button>
            </div>
          ` : ""}
        </div>
      </article>
    `).join("");
  }

  async function handleSharedMetaSubmit(event) {
    event.preventDefault();
    if (!shareId || !canEditSharedList) return;

    const title = sanitizeText(readerSharedTitleInput.value, 80) || "Lista compartilhada";
    const description = sanitizeMultilineText(readerSharedDescriptionInput.value, 240) || defaultDescription;
    const updatedAt = new Date().toISOString();

    try {
      readerSharedMetaFeedback.textContent = "Salvando ajustes...";
      await saveSharedListPatch({
        title,
        description,
        updatedAt
      });
      readerSharedMetaFeedback.textContent = "Lista compartilhada atualizada.";
    } catch (error) {
      console.error("Erro ao salvar a lista compartilhada:", error);
      readerSharedMetaFeedback.textContent = "Nao foi possivel salvar os ajustes agora.";
    }
  }

  async function handleAddSharedMovie(event) {
    event.preventDefault();
    if (!shareId || !canEditSharedList) return;

    const title = sanitizeText(readerMovieTitleInput.value, 120);
    const genre = sanitizeText(readerMovieGenreInput.value, 60) || "Filme";
    const year = Math.round(clampNumber(readerMovieYearInput.value, 1900, 2100, new Date().getFullYear()));
    const rating = Number(clampNumber(readerMovieRatingInput.value, 0, 5, 0).toFixed(1));
    const note = sanitizeMultilineText(readerMovieNoteInput.value, 1200);
    const poster = safePosterUrl(readerMoviePosterInput.value || "") || defaultPoster;

    if (!title) {
      readerAddMovieFeedback.textContent = "Informe o titulo do filme para adicionar na lista.";
      return;
    }

    const movie = {
      id: `shared-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      sharedSourceId: currentShareId || shareId,
      title,
      genre,
      year,
      rating,
      note,
      poster
    };

    try {
      readerAddMovieFeedback.textContent = "Adicionando filme...";
      await saveSharedListPatch({
        movies: [movie, ...activeListState.movies],
        updatedAt: new Date().toISOString()
      });
      readerAddMovieForm.reset();
      readerAddMovieFeedback.textContent = `${movie.title} entrou na lista compartilhada.`;
    } catch (error) {
      console.error("Erro ao adicionar filme compartilhado:", error);
      readerAddMovieFeedback.textContent = "Nao foi possivel adicionar o filme agora.";
    }
  }

  async function handleRemoveSharedMovie(event) {
    const movieId = String(event.currentTarget.dataset.readerRemove || "");
    if (!movieId || !shareId || !canEditSharedList) return;

    const nextMovies = activeListState.movies.filter((movie) => String(movie.id || "") !== movieId);
    const removedMovie = activeListState.movies.find((movie) => String(movie.id || "") === movieId);

    try {
      await saveSharedListPatch({
        movies: nextMovies,
        updatedAt: new Date().toISOString()
      });

      if (readerAddMovieFeedback) {
        readerAddMovieFeedback.textContent = removedMovie
          ? `${removedMovie.title} foi removido da lista compartilhada.`
          : "Filme removido da lista compartilhada.";
      }
    } catch (error) {
      console.error("Erro ao remover filme compartilhado:", error);
      if (readerAddMovieFeedback) {
        readerAddMovieFeedback.textContent = "Nao foi possivel remover o filme agora.";
      }
    }
  }

  async function saveSharedListPatch(patch) {
    if (!firestore || !currentShareId) {
      throw new Error("Compartilhamento indisponivel.");
    }

    await firestore.collection("shared_lists").doc(currentShareId).set(patch, { merge: true });
  }

  async function hydrateReaderMovieCertifications() {
    if (!window.TMDB || typeof window.TMDB.getMovieCertificationLabel !== "function") {
      return false;
    }

    let hasUpdates = false;
    const movies = Array.isArray(activeListState.movies) ? activeListState.movies : [];

    await Promise.all(movies.map(async (movie) => {
      const tmdbId = getMovieTmdbId(movie);
      if (!tmdbId || movie.certificationLabel) {
        return;
      }

      try {
        const certificationLabel = await window.TMDB.getMovieCertificationLabel(tmdbId);
        if (certificationLabel) {
          movie.certificationLabel = certificationLabel;
          hasUpdates = true;
        }
      } catch (error) {
        movie.certificationLabel = "";
      }
    }));

    return hasUpdates;
  }

  function updateEditAccessState() {
    const currentUid = getCurrentUid();
    const readerOnlyUserIds = Array.isArray(activeShareSettings.shareReaderOnlyUserIds)
      ? activeShareSettings.shareReaderOnlyUserIds
      : [];
    const isReaderOnly = readerOnlyUserIds.includes(currentUid);

    canEditSharedList = Boolean(
      shareId &&
      currentUid &&
      (
        currentUid === activeShareSettings.ownerUid ||
        (activeShareSettings.shareAccessLevel === "editor" && !isReaderOnly)
      )
    );
  }

  function getCurrentUid() {
    const authUid = auth && auth.currentUser ? String(auth.currentUser.uid || "") : "";
    if (authUid) return authUid;

    const profile = store.loadProfile();
    return String(profile && profile.uid ? profile.uid : "");
  }

  function normalizeSharedListState(listState) {
    const source = listState && typeof listState === "object" ? listState : {};
    return {
      title: sanitizeText(source.title || "Lista compartilhada", 80) || "Lista compartilhada",
      description: sanitizeMultilineText(source.description || defaultDescription, 240) || defaultDescription,
      movies: Array.isArray(source.movies) ? source.movies.slice(0, 120).map(normalizeMovie) : []
    };
  }

  function normalizeMovie(movie) {
    const source = movie && typeof movie === "object" ? movie : {};
    return {
      ...source,
      id: sanitizeText(source.id || `shared-${Date.now()}`, 160) || `shared-${Date.now()}`,
      tmdbId: String(source.tmdbId || "").replace(/[^0-9]/g, "").slice(0, 32),
      title: sanitizeText(source.title || "Titulo indisponivel", 120) || "Titulo indisponivel",
      genre: sanitizeText(source.genre || "Filme", 60) || "Filme",
      year: Math.round(clampNumber(source.year, 1900, 2100, new Date().getFullYear())),
      rating: Number(clampNumber(source.rating, 0, 5, 0).toFixed(1)),
      note: sanitizeMultilineText(source.note || "", 1200),
      poster: safePosterUrl(source.poster || "") || defaultPoster,
      certificationLabel: sanitizeText(source.certificationLabel || "", 8)
    };
  }

  function renderUnavailableState(message) {
    document.title = "Cinefy Club - Lista compartilhada indisponivel";
    readerTitle.textContent = "Lista compartilhada indisponivel";
    readerDescription.textContent = message;
    readerMovieCount.textContent = "0";
    readerMovieCountInline.textContent = "0";
    readerOwnerName.textContent = "Cinefy Club";
    readerOwnerHandle.textContent = "@cinefy";
    readerOwnerAvatar.src = "/assets/img/logo.png";
    readerStatusValue.textContent = "Indisponivel";
    readerExperienceCopy.textContent = "O link nao pode ser aberto no momento.";
    if (readerEditorPanel) {
      readerEditorPanel.classList.add("hidden");
    }
    readerGrid.innerHTML = `
      <div class="reader-empty-state">
        <span class="material-symbols-outlined text-5xl text-red-400">error</span>
        <p class="text-xl font-black text-white">Nao foi possivel abrir essa lista.</p>
        <p class="mt-2 text-zinc-400">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function getMovieTmdbId(movie) {
    if (!movie) return "";
    if (movie.tmdbId) return String(movie.tmdbId);

    const movieId = String(movie.id || "");
    if (movieId.startsWith("tmdb-")) {
      return movieId.replace("tmdb-", "");
    }

    return "";
  }

  function getMovieDetailsHref(movie) {
    if (movie.tmdbId) {
      return `detalhes.html?id=${encodeURIComponent(String(movie.tmdbId || ""))}`;
    }

    if (String(movie.id || "").startsWith("tmdb-")) {
      return `detalhes.html?id=${encodeURIComponent(String(movie.id).replace("tmdb-", ""))}`;
    }

    if (String(movie.id || "").startsWith("manual-") || String(movie.id || "").startsWith("movie-") || String(movie.id || "").startsWith("shared-") || movie.id) {
      const query = new URLSearchParams({ local: String(movie.id || "") });
      if (currentShareId) {
        query.set("share", String(currentShareId));
      }
      return `detalhes.html?${query.toString()}`;
    }

    return "lista.html";
  }

  function formatRating(value) {
    return typeof value === "number" ? value.toFixed(1) : "N/A";
  }

  function sanitizeText(value, maxLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function sanitizeMultilineText(value, maxLength) {
    return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().slice(0, maxLength);
  }

  function clampNumber(value, min, max, fallback) {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return fallback;
    return Math.min(max, Math.max(min, parsedValue));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function safePosterUrl(value) {
    const candidate = String(value || "").trim();
    if (!candidate) return defaultPoster;

    if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
      return candidate;
    }

    try {
      const parsedUrl = new URL(candidate, window.location.origin);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.href;
      }
    } catch (error) {
      return defaultPoster;
    }

    return defaultPoster;
  }

  function safeAvatarUrl(value) {
    const candidate = String(value || "").trim();
    if (!candidate) return "/assets/img/logo.png";

    if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
      return candidate;
    }

    try {
      const parsedUrl = new URL(candidate, window.location.origin);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.href;
      }
    } catch (error) {
      return "/assets/img/logo.png";
    }

    return "/assets/img/logo.png";
  }

  function getPublicProfileHref(user) {
    if (window.CinefyProfiles && typeof window.CinefyProfiles.buildPublicProfileHref === "function") {
      return window.CinefyProfiles.buildPublicProfileHref(user);
    }

    return "perfil.html";
  }
})();
