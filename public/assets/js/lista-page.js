(function () {
  window.CinefyListaPageLoaded = true;

  const store = window.CinefyStore;
  const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
  const DEFAULT_POSTER = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
  const DEFAULT_LIST_TITLE = "Lista sem nome";
  const DEFAULT_LIST_DESCRIPTION = "Uma lista com filmes que recomendo.";

  let state = store.loadListState();
  let lists = store.loadLists();
  let lastPublishedSignature = "";

  const movieGrid = document.getElementById("movieGrid");
  const emptyState = document.getElementById("emptyState");
  const movieForm = document.getElementById("movieForm");
  const listSettingsForm = document.getElementById("listSettingsForm");
  const shareLinkInput = document.getElementById("shareLinkInput");
  const shareFeedback = document.getElementById("shareFeedback");
  const settingsFeedback = document.getElementById("settingsFeedback");
  const newListNameInput = document.getElementById("newListNameInput");
  const createListButton = document.getElementById("createListButton");
  const listSelector = document.getElementById("listSelector");
  const deleteCurrentListButton = document.getElementById("deleteCurrentListButton");
  const moviePosterUrlInput = document.getElementById("moviePosterUrl");
  const moviePosterFileInput = document.getElementById("moviePosterFile");
  const moviePosterDropzone = document.getElementById("moviePosterDropzone");
  const moviePosterFeedback = document.getElementById("moviePosterFeedback");
  const movieFormFeedback = document.getElementById("movieFormFeedback");
  const moviePosterPreviewImage = document.getElementById("moviePosterPreviewImage");
  const moviePosterPreviewTitle = document.getElementById("moviePosterPreviewTitle");
  const moviePosterPreviewMeta = document.getElementById("moviePosterPreviewMeta");
  const openPosterPreviewButton = document.getElementById("openPosterPreviewButton");
  const clearPosterSelectionButton = document.getElementById("clearPosterSelectionButton");
  const posterPreviewModal = document.getElementById("posterPreviewModal");
  const posterPreviewModalImage = document.getElementById("posterPreviewModalImage");
  const posterPreviewDialogTitle = document.getElementById("posterPreviewDialogTitle");
  const posterPreviewDialogMeta = document.getElementById("posterPreviewDialogMeta");
  const posterPreviewCloseButtons = Array.from(document.querySelectorAll("[data-poster-preview-close]"));
  const posterModeButtons = Array.from(document.querySelectorAll("[data-poster-mode]"));
  const posterPanels = Array.from(document.querySelectorAll("[data-poster-panel]"));

  let manualPosterMode = "upload";
  let manualPosterFile = null;
  let manualPosterPreviewUrl = "";
  let isPosterPreviewOpen = false;

  document.getElementById("copyShareButton").addEventListener("click", copyShareLink);
  document.getElementById("resetListButton").addEventListener("click", resetList);
  movieForm.addEventListener("submit", handleAddMovie);
  listSettingsForm.addEventListener("submit", handleSaveSettings);
  createListButton.addEventListener("click", handleCreateList);
  deleteCurrentListButton.addEventListener("click", handleDeleteCurrentList);
  listSelector.addEventListener("change", handleSelectList);
  newListNameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleCreateList();
  });
  posterModeButtons.forEach((button) => {
    button.addEventListener("click", () => setPosterMode(button.dataset.posterMode));
  });
  moviePosterDropzone.addEventListener("click", () => moviePosterFileInput.click());
  moviePosterDropzone.addEventListener("dragover", handlePosterDragOver);
  moviePosterDropzone.addEventListener("dragleave", handlePosterDragLeave);
  moviePosterDropzone.addEventListener("drop", handlePosterDrop);
  moviePosterFileInput.addEventListener("change", handlePosterInputChange);
  moviePosterUrlInput.addEventListener("input", handlePosterUrlPreview);
  openPosterPreviewButton.addEventListener("click", openPosterPreviewModal);
  clearPosterSelectionButton.addEventListener("click", handleClearPosterSelection);
  posterPreviewCloseButtons.forEach((button) => {
    button.addEventListener("click", closePosterPreviewModal);
  });
  document.addEventListener("keydown", handlePosterPreviewKeydown);

  setPosterMode("upload");
  updatePosterPreview(DEFAULT_POSTER, "Poster padrao", "Sera usado se nenhuma imagem for enviada.");
  updateClearPosterButtonState();
  updatePosterPreviewButtonState();
  render();

  function getCurrentProfile() {
    return store.loadProfile();
  }

  function reloadState(options) {
    const safeOptions = options || {};
    state = store.loadListState();
    lists = store.loadLists();

    if (safeOptions.resetSignature) {
      lastPublishedSignature = "";
    }
  }

  function saveState() {
    state = store.saveListState(state);
    lists = store.loadLists();
  }

  function hydrateForms() {
    document.getElementById("listTitleInput").value = state.title || DEFAULT_LIST_TITLE;
    document.getElementById("listDescriptionInput").value = state.description || DEFAULT_LIST_DESCRIPTION;
    document.getElementById("listPrivacyInput").value = state.privacy === "privada" ? "privada" : "publica";
  }

  function render() {
    hydrateForms();
    renderHeader();
    renderMovies();
    renderShareLink();
    saveState();
    renderListSelector();
    updateDeleteButtonState();
    void syncSharedList();
  }

  function renderListSelector() {
    listSelector.innerHTML = lists.map((list) => `
      <option value="${escapeAttribute(list.id)}">${escapeHtml(list.title || DEFAULT_LIST_TITLE)}</option>
    `).join("");

    listSelector.value = state.id;
  }

  function updateDeleteButtonState() {
    const isDisabled = !state || !state.id;
    deleteCurrentListButton.disabled = isDisabled;
    deleteCurrentListButton.classList.toggle("opacity-60", isDisabled);
    deleteCurrentListButton.classList.toggle("cursor-not-allowed", isDisabled);
  }

  function renderHeader() {
    document.getElementById("listTitleHeading").textContent = state.title || DEFAULT_LIST_TITLE;
    document.getElementById("listDescriptionHeading").textContent = state.description || DEFAULT_LIST_DESCRIPTION;
    document.getElementById("movieCount").textContent = state.movies.length;
    document.getElementById("movieCountInline").textContent = state.movies.length;
    document.getElementById("privacyLabel").textContent = state.privacy === "publica" ? "Sim" : "Nao";
    document.getElementById("topGenre").textContent = getTopGenre();
    document.getElementById("updatedAt").textContent = formatDate(state.updatedAt);
  }

  function renderMovies() {
    if (!state.movies.length) {
      movieGrid.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    movieGrid.innerHTML = state.movies.map((movie) => `
      <article class="group glass-card rounded-3xl overflow-hidden flex flex-col">
        <div class="relative aspect-[2/3] overflow-hidden">
          <a href="${escapeAttribute(getMovieDetailsHref(movie))}">
            <img alt="${escapeAttribute(movie.title || "Poster do filme")}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="${escapeAttribute(movie.poster || DEFAULT_POSTER)}" />
          </a>
          <div class="movie-overlay absolute inset-0"></div>
          <div class="absolute top-3 right-3 flex items-center gap-1 bg-black/60 rounded-full px-3 py-1 border border-white/10">
            <span class="material-symbols-outlined text-yellow-400 text-sm">star</span>
            <span class="text-white text-xs font-bold">${formatRating(movie.rating)}</span>
          </div>
          <button class="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 transition-all active:scale-95" data-action="remove" data-id="${escapeAttribute(movie.id)}" type="button">
            <span class="material-symbols-outlined text-sm">delete</span>
            <span>Remover</span>
          </button>
        </div>
        <div class="p-5 flex flex-col gap-3 flex-1">
          <div class="flex items-start justify-between gap-3">
            <div>
              <a class="text-lg font-black text-white leading-tight hover:text-red-300 transition-colors" href="${escapeAttribute(getMovieDetailsHref(movie))}">${escapeHtml(movie.title || "Titulo indisponivel")}</a>
              <p class="text-sm text-zinc-400">${escapeHtml(movie.genre || "Filme")} &bull; ${escapeHtml(String(movie.year || "Sem ano"))}</p>
            </div>
          </div>
          <p class="text-sm text-zinc-300 leading-relaxed flex-1">${escapeHtml(movie.note || "Sem comentario adicionado.")}</p>
        </div>
      </article>
    `).join("");

    movieGrid.querySelectorAll('[data-action="remove"]').forEach((button) => {
      button.addEventListener("click", () => removeMovie(button.dataset.id));
    });
  }

  function handleCreateList() {
    const name = newListNameInput.value.trim();
    store.createList(name || DEFAULT_LIST_TITLE);
    newListNameInput.value = "";
    reloadState({ resetSignature: true });
    render();
    settingsFeedback.textContent = `A lista "${state.title}" foi criada.`;
  }

  function handleSelectList() {
    if (!listSelector.value) return;

    store.selectList(listSelector.value);
    reloadState({ resetSignature: true });
    render();
    settingsFeedback.textContent = `Agora voce esta editando "${state.title}".`;
  }

  async function handleDeleteCurrentList() {
    const listTitle = state.title || DEFAULT_LIST_TITLE;
    const confirmed = window.confirm(`Excluir a lista "${listTitle}"? Essa acao nao pode ser desfeita.`);
    if (!confirmed) return;

    const shareIdToDelete = state.shareId || "";
    if (shareIdToDelete) {
      await deleteSharedList(shareIdToDelete, "Erro ao remover a lista compartilhada antes da exclusao:");
    }

    store.deleteList(state.id);
    reloadState({ resetSignature: true });
    render();
    settingsFeedback.textContent = `A lista "${listTitle}" foi excluida.`;
    shareFeedback.textContent = "A lista ativa foi atualizada.";
  }

  async function handleAddMovie(event) {
    event.preventDefault();

    try {
      setMovieFormFeedback("");

      const movie = {
        id: `movie-${Date.now()}`,
        title: document.getElementById("movieTitle").value.trim(),
        genre: document.getElementById("movieGenre").value.trim(),
        year: Number(document.getElementById("movieYear").value),
        rating: Number(document.getElementById("movieRating").value),
        note: document.getElementById("movieNote").value.trim(),
        poster: await resolveManualPoster()
      };

      state.movies.unshift(movie);
      touchState();
      movieForm.reset();
      clearPosterSelection();
      setPosterMode("upload");
      render();
      shareFeedback.textContent = `${movie.title} foi adicionado a lista "${state.title}".`;
      setMovieFormFeedback("Filme adicionado com sucesso.");
    } catch (error) {
      setMovieFormFeedback(error.message || "Nao foi possivel adicionar o filme agora.");
    }
  }

  function handleSaveSettings(event) {
    event.preventDefault();
    state.title = document.getElementById("listTitleInput").value.trim() || DEFAULT_LIST_TITLE;
    state.description = document.getElementById("listDescriptionInput").value.trim() || DEFAULT_LIST_DESCRIPTION;
    state.privacy = document.getElementById("listPrivacyInput").value === "privada" ? "privada" : "publica";
    touchState();
    render();
    settingsFeedback.textContent = `As informacoes de "${state.title}" foram atualizadas.`;
  }

  function removeMovie(id) {
    const movie = state.movies.find((item) => item.id === id);
    state.movies = state.movies.filter((item) => item.id !== id);
    touchState();
    render();
    shareFeedback.textContent = movie ? `${movie.title} foi removido da lista.` : "Filme removido da lista.";
  }

  function resetList() {
    const listTitle = state.title || DEFAULT_LIST_TITLE;
    store.resetListState(state.id);
    reloadState({ resetSignature: true });
    render();
    shareFeedback.textContent = `A lista "${listTitle}" foi limpa para voce personalizar como quiser.`;
  }

  function touchState() {
    state.updatedAt = new Date().toISOString();
  }

  function renderShareLink() {
    const currentProfile = getCurrentProfile();

    if (!firestore || !currentProfile.uid) {
      shareLinkInput.value = "";
      shareLinkInput.disabled = true;
      shareLinkInput.placeholder = "Disponivel quando o Firebase estiver conectado.";
      return;
    }

    if (state.privacy !== "publica") {
      shareLinkInput.value = "";
      shareLinkInput.disabled = true;
      shareLinkInput.placeholder = "Defina a lista como publica para gerar um link.";
      return;
    }

    shareLinkInput.disabled = false;
    shareLinkInput.placeholder = "";
    shareLinkInput.value = buildShareUrl();
  }

  async function copyShareLink() {
    const currentProfile = getCurrentProfile();

    if (!shareLinkInput.value) {
      shareFeedback.textContent = !firestore || !currentProfile.uid
        ? "O compartilhamento real exige uma sessao com Firebase ativa."
        : "Defina a lista como publica para gerar um link compartilhavel.";
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
      shareFeedback.textContent = "Link copiado para a area de transferencia.";
    } catch (error) {
      shareLinkInput.select();
      document.execCommand("copy");
      shareFeedback.textContent = "Link copiado com metodo alternativo.";
    }
  }

  function getTopGenre() {
    const counts = state.movies.reduce((accumulator, movie) => {
      const genre = movie.genre || "Sem genero";
      accumulator[genre] = (accumulator[genre] || 0) + 1;
      return accumulator;
    }, {});

    const topEntry = Object.entries(counts).sort((left, right) => right[1] - left[1])[0];
    return topEntry ? topEntry[0] : "Sem genero";
  }

  function formatDate(isoString) {
    if (!isoString) return "Agora";

    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "Agora";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function formatRating(value) {
    const rating = Number(value);
    return Number.isFinite(rating) ? rating.toFixed(1) : "0.0";
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getShareId() {
    if (state.shareId) return state.shareId;

    state.shareId = `share-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    return state.shareId;
  }

  function getShareSlug() {
    return slugify(state.title || "minha-lista") || "minha-lista";
  }

  function buildShareUrl() {
    const shareUrl = new URL(window.location.href);
    shareUrl.pathname = shareUrl.pathname.replace(/lista\.html$/i, "modoleitor.html");
    shareUrl.search = new URLSearchParams({
      share: getShareId(),
      lista: getShareSlug()
    }).toString();
    shareUrl.hash = "";

    return shareUrl.toString();
  }

  function buildSharedListPayload() {
    const currentProfile = getCurrentProfile();
    if (!currentProfile.uid) return null;

    const createdAt = state.sharedCreatedAt || state.updatedAt || new Date().toISOString();
    if (!state.sharedCreatedAt) {
      state.sharedCreatedAt = createdAt;
      saveState();
    }

    return {
      shareId: getShareId(),
      slug: getShareSlug(),
      ownerUid: currentProfile.uid,
      ownerListId: state.id,
      ownerUsername: currentProfile.username || "cinefyuser",
      ownerDisplayName: currentProfile.displayName || "Cinefilo",
      ownerAvatar: currentProfile.avatar || "",
      title: state.title,
      description: state.description,
      privacy: state.privacy,
      updatedAt: state.updatedAt || new Date().toISOString(),
      createdAt,
      movies: state.movies.map((movie) => ({
        ...movie,
        poster: movie.poster || DEFAULT_POSTER
      }))
    };
  }

  async function deleteSharedList(shareId, errorMessage) {
    const currentProfile = getCurrentProfile();
    if (!firestore || !currentProfile.uid || !shareId) return;

    try {
      await firestore.collection("shared_lists").doc(shareId).delete();
    } catch (error) {
      console.error(errorMessage, error);
    }
  }

  async function syncSharedList() {
    const currentProfile = getCurrentProfile();

    if (!firestore || !currentProfile.uid) {
      lastPublishedSignature = "";
      return;
    }

    if (state.privacy !== "publica") {
      if (state.shareId) {
        await deleteSharedList(state.shareId, "Erro ao remover lista compartilhada privada:");
      }

      lastPublishedSignature = "";
      return;
    }

    const payload = buildSharedListPayload();
    if (!payload) return;

    const signature = JSON.stringify(payload);
    if (signature === lastPublishedSignature) return;

    try {
      await firestore.collection("shared_lists").doc(payload.shareId).set(payload, { merge: true });
      lastPublishedSignature = signature;
    } catch (error) {
      console.error("Erro ao publicar lista compartilhada:", error);
      shareFeedback.textContent = "Nao foi possivel publicar a lista agora.";
    }
  }

  function getMovieDetailsHref(movie) {
    if (movie.tmdbId) {
      return `detalhes.html?id=${movie.tmdbId}`;
    }

    if (String(movie.id || "").startsWith("tmdb-")) {
      return `detalhes.html?id=${String(movie.id).replace("tmdb-", "")}`;
    }

    if (String(movie.id || "").startsWith("manual-") || String(movie.id || "").startsWith("movie-") || movie.id) {
      return `detalhes.html?local=${encodeURIComponent(movie.id)}`;
    }

    return "lista.html";
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setPosterMode(mode) {
    manualPosterMode = mode === "url" ? "url" : "upload";

    posterModeButtons.forEach((button) => {
      const isActive = button.dataset.posterMode === manualPosterMode;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("bg-white", isActive);
      button.classList.toggle("text-black", isActive);
      button.classList.toggle("text-zinc-300", !isActive);
    });

    posterPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.posterPanel !== manualPosterMode);
    });

    if (manualPosterMode === "url") {
      handlePosterUrlPreview();
      return;
    }

    if (manualPosterFile && manualPosterPreviewUrl) {
      updatePosterPreview(manualPosterPreviewUrl, "Arquivo selecionado", manualPosterFile.name);
      updateClearPosterButtonState();
      updatePosterPreviewButtonState();
      return;
    }

    updatePosterPreview(DEFAULT_POSTER, "Poster padrao", "Sera usado se nenhuma imagem for enviada.");
    updateClearPosterButtonState();
    updatePosterPreviewButtonState();
  }

  function handlePosterInputChange(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    loadPosterFile(file);
  }

  function handlePosterDragOver(event) {
    event.preventDefault();
    moviePosterDropzone.classList.add("border-red-500");
  }

  function handlePosterDragLeave() {
    moviePosterDropzone.classList.remove("border-red-500");
  }

  function handlePosterDrop(event) {
    event.preventDefault();
    moviePosterDropzone.classList.remove("border-red-500");

    const [file] = Array.from(event.dataTransfer.files || []);
    if (!file) return;
    loadPosterFile(file);
  }

  function loadPosterFile(file) {
    if (!file.type.startsWith("image/")) {
      throwPosterError("Selecione uma imagem PNG, JPG ou WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      throwPosterError("O poster precisa ter no maximo 5 MB.");
      return;
    }

    manualPosterFile = file;
    moviePosterFeedback.textContent = `Poster selecionado: ${file.name}`;
    setMovieFormFeedback("");
    setPosterMode("upload");
    setPreviewFromFile(file);
    updateClearPosterButtonState();
    updatePosterPreviewButtonState();
  }

  function clearPosterSelection() {
    resetPreviewObjectUrl();
    manualPosterFile = null;
    moviePosterFileInput.value = "";
    if (moviePosterUrlInput) {
      moviePosterUrlInput.value = "";
    }
    moviePosterFeedback.textContent = "Nenhum poster selecionado.";
    moviePosterDropzone.classList.remove("border-red-500");
    updatePosterPreview(DEFAULT_POSTER, "Poster padrao", "Sera usado se nenhuma imagem for enviada.");
    updateClearPosterButtonState();
    updatePosterPreviewButtonState();
  }

  function handleClearPosterSelection() {
    if (!hasCustomPosterSelection()) return;

    clearPosterSelection();
    setMovieFormFeedback("Poster removido. O poster padrao sera usado.");
  }

  async function resolveManualPoster() {
    if (manualPosterMode === "url") {
      const posterUrl = (moviePosterUrlInput.value || "").trim();
      return sanitizePosterUrl(posterUrl) || DEFAULT_POSTER;
    }

    if (!manualPosterFile) {
      return DEFAULT_POSTER;
    }

    if (window.CinefyStorage && typeof window.CinefyStorage.uploadUserImage === "function") {
      try {
        setMovieFormFeedback("Enviando poster personalizado...");
        return await window.CinefyStorage.uploadUserImage(manualPosterFile, "posters");
      } catch (error) {
        setMovieFormFeedback("Poster salvo localmente. O upload em nuvem falhou nesta tentativa.");
      }
    }

    return await readFileAsDataUrl(manualPosterFile);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Nao foi possivel ler o poster selecionado."));
      reader.readAsDataURL(file);
    });
  }

  function throwPosterError(message) {
    setMovieFormFeedback(message);
    moviePosterFeedback.textContent = "Nenhum poster selecionado.";
    resetPreviewObjectUrl();
    manualPosterFile = null;
    moviePosterFileInput.value = "";
    updatePosterPreview(DEFAULT_POSTER, "Poster padrao", "Sera usado se nenhuma imagem for enviada.");
    updateClearPosterButtonState();
  }

  function setMovieFormFeedback(message) {
    if (!movieFormFeedback) return;
    movieFormFeedback.textContent = message || "";
  }

  function handlePosterUrlPreview() {
    if (manualPosterMode !== "url") return;

    const posterUrl = sanitizePosterUrl(moviePosterUrlInput.value);
    if (!posterUrl) {
      updatePosterPreview(DEFAULT_POSTER, "Poster padrao", "Cole uma URL valida para ver a previa.");
      updateClearPosterButtonState();
      updatePosterPreviewButtonState();
      return;
    }

    updatePosterPreview(posterUrl, "Poster por URL", "Previa carregada a partir do link informado.");
    updateClearPosterButtonState();
    updatePosterPreviewButtonState();
  }

  function setPreviewFromFile(file) {
    resetPreviewObjectUrl();
    manualPosterPreviewUrl = URL.createObjectURL(file);
    updatePosterPreview(manualPosterPreviewUrl, "Arquivo selecionado", file.name);
  }

  function updatePosterPreview(src, title, meta) {
    if (!moviePosterPreviewImage) return;
    const safeSrc = src || DEFAULT_POSTER;
    const safeTitle = title || "Poster padrao";
    const safeMeta = meta || "Sera usado se nenhuma imagem for enviada.";

    moviePosterPreviewImage.src = safeSrc;
    moviePosterPreviewTitle.textContent = safeTitle;
    moviePosterPreviewMeta.textContent = safeMeta;

    if (posterPreviewModalImage) {
      posterPreviewModalImage.src = safeSrc;
    }
    if (posterPreviewDialogTitle) {
      posterPreviewDialogTitle.textContent = safeTitle;
    }
    if (posterPreviewDialogMeta) {
      posterPreviewDialogMeta.textContent = safeMeta;
    }
  }

  function hasCustomPosterSelection() {
    if (manualPosterFile) return true;
    return Boolean(sanitizePosterUrl(moviePosterUrlInput ? moviePosterUrlInput.value : ""));
  }

  function updateClearPosterButtonState() {
    if (!clearPosterSelectionButton) return;
    clearPosterSelectionButton.disabled = !hasCustomPosterSelection();
  }

  function updatePosterPreviewButtonState() {
    if (!openPosterPreviewButton) return;
    openPosterPreviewButton.disabled = !moviePosterPreviewImage || !moviePosterPreviewImage.src;
  }

  function openPosterPreviewModal() {
    if (!posterPreviewModal || !moviePosterPreviewImage || !moviePosterPreviewImage.src) return;

    posterPreviewModal.classList.remove("hidden");
    posterPreviewModal.classList.add("flex");
    posterPreviewModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("overflow-hidden");
    isPosterPreviewOpen = true;
  }

  function closePosterPreviewModal() {
    if (!posterPreviewModal || !isPosterPreviewOpen) return;

    posterPreviewModal.classList.add("hidden");
    posterPreviewModal.classList.remove("flex");
    posterPreviewModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overflow-hidden");
    isPosterPreviewOpen = false;
  }

  function handlePosterPreviewKeydown(event) {
    if (event.key !== "Escape") return;
    closePosterPreviewModal();
  }

  function resetPreviewObjectUrl() {
    if (!manualPosterPreviewUrl) return;
    URL.revokeObjectURL(manualPosterPreviewUrl);
    manualPosterPreviewUrl = "";
  }

  function sanitizePosterUrl(value) {
    const candidate = String(value || "").trim();
    if (!candidate) return "";

    if (candidate.startsWith("data:image/") || candidate.startsWith("blob:")) {
      return candidate;
    }

    try {
      const parsedUrl = new URL(candidate, window.location.origin);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.href;
      }
    } catch (error) {
      return "";
    }

    return "";
  }
})();
