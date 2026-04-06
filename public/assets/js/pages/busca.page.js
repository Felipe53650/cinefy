const store = window.CinefyStore;
      const SEARCH_PLACEHOLDER_POSTER = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
      const VIEW_STORAGE_KEY = "cinefy-search-view";
      let currentView = loadViewPreference();
      let currentMovies = [];

      const searchInput = document.getElementById("movieSearchInput");
      const searchButton = document.getElementById("movieSearchButton");
      const searchStatus = document.getElementById("searchStatus");
      const resultsSubtitle = document.getElementById("resultsSubtitle");
      const resultsGrid = document.getElementById("resultsGrid");
      const loadingState = document.getElementById("loadingState");
      const emptyState = document.getElementById("emptyState");
      const gridViewButton = document.getElementById("gridViewButton");
      const listViewButton = document.getElementById("listViewButton");
      const manualMovieForm = document.getElementById("manualMovieForm");
      const manualMovieFeedback = document.getElementById("manualMovieFeedback");
      const posterUploadBox = document.getElementById("posterUploadBox");
      const manualPosterInput = document.getElementById("manualPosterInput");
      const posterUploadFeedback = document.getElementById("posterUploadFeedback");
      let manualPosterFile = null;

      searchButton.addEventListener("click", runSearch);
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch();
        }
      });
      gridViewButton.addEventListener("click", () => setView("grid"));
      listViewButton.addEventListener("click", () => setView("list"));
      manualMovieForm.addEventListener("submit", handleManualMovieSubmit);
      posterUploadBox.addEventListener("click", () => manualPosterInput.click());
      posterUploadBox.addEventListener("dragover", handlePosterDragOver);
      posterUploadBox.addEventListener("dragleave", handlePosterDragLeave);
      posterUploadBox.addEventListener("drop", handlePosterDrop);
      manualPosterInput.addEventListener("change", handlePosterInputChange);

      applyViewMode();
      loadPopularMovies();

      async function loadPopularMovies() {
        try {
          setLoading(true);
          const movies = await window.TMDB.getPopularMovies();
          resultsSubtitle.textContent = "Exibindo os filmes mais populares";
          searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">info</span> Integrado em tempo real com o banco de dados do TMDB.';
          renderMovies(movies);
        } catch (error) {
          handleSearchError(error);
        } finally {
          setLoading(false);
        }
      }

      async function runSearch() {
        const query = searchInput.value.trim();

        if (!query) {
          loadPopularMovies();
          return;
        }

        try {
          setLoading(true);
          const movies = await window.TMDB.searchMovies(query);
          resultsSubtitle.textContent = `Resultados para "${escapeHtml(query)}"`;
          searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">search</span> Busca concluida no TMDB.';
          renderMovies(movies);
        } catch (error) {
          handleSearchError(error);
        } finally {
          setLoading(false);
        }
      }

      function renderMovies(movies) {
        currentMovies = movies;
        if (!movies.length) {
          resultsGrid.innerHTML = "";
          emptyState.classList.remove("hidden");
          return;
        }

        applyViewMode();
        emptyState.classList.add("hidden");
        resultsGrid.innerHTML = movies.map((movie) => {
          const releaseYear = movie.release_date ? movie.release_date.slice(0, 4) : "Sem ano";
          const rating = typeof movie.vote_average === "number" ? movie.vote_average.toFixed(1) : "N/A";
          const poster = window.TMDB.getImageUrl(movie.poster_path, SEARCH_PLACEHOLDER_POSTER);
          const articleClass = currentView === "list"
            ? "group relative flex flex-col overflow-hidden rounded-[1.9rem] border border-white/10 bg-[#241314] transition hover:border-red-500/20 hover:bg-[#2a1718] md:flex-row"
            : "group relative flex h-full flex-col overflow-hidden rounded-[1.9rem] border border-white/10 bg-[#241314] transition hover:-translate-y-1 hover:border-red-500/20 hover:bg-[#2a1718]";
          const mediaClass = currentView === "list"
            ? "relative overflow-hidden md:w-52 md:min-w-52 aspect-[2/3] md:aspect-auto"
            : "relative aspect-[2/3] overflow-hidden";
          const contentClass = currentView === "list"
            ? "flex flex-1 flex-col justify-between p-5"
            : "flex flex-1 flex-col justify-between p-5";

          return `
            <article class="${articleClass}">
              <div class="${mediaClass}">
                <img alt="${escapeHtml(movie.title)}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" decoding="async" loading="lazy" src="${escapeAttribute(safePosterUrl(poster))}" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"></div>
                <div class="absolute right-3 top-3">
                  <span class="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                    <span class="material-symbols-outlined fill-icon text-[13px] text-yellow-400">star</span>${rating}
                  </span>
                </div>
              </div>
              <div class="${contentClass}">
                <div>
                  <h4 class="text-base font-bold text-white ${currentView === "list" ? "" : "line-clamp-1"}">${escapeHtml(movie.title)}</h4>
                  <span class="mt-1 inline-block text-xs uppercase tracking-[0.2em] text-zinc-500">${releaseYear}</span>
                  <p class="mt-3 text-sm leading-relaxed text-zinc-400 ${currentView === "list" ? "line-clamp-4" : "line-clamp-3"}">${escapeHtml(movie.overview || "Sem sinopse disponivel no TMDB.")}</p>
                </div>
                <div class="mt-5 grid grid-cols-2 gap-2">
                  <a class="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/[0.08]" href="detalhes.html?id=${encodeURIComponent(String(movie.id || ""))}">
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                    Detalhes
                  </a>
                  <button class="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-red-600" data-add-movie="${escapeAttribute(JSON.stringify(movie))}" type="button">
                    <span class="material-symbols-outlined text-sm">add</span>
                    Minha Lista
                  </button>
                </div>
              </div>
            </article>
          `;
        }).join("");

        resultsGrid.querySelectorAll("[data-add-movie]").forEach((button) => {
          button.addEventListener("click", () => {
            const movie = JSON.parse(button.dataset.addMovie);
            const added = addMovieToList(movie);
            if (!added) return;
            button.innerHTML = '<span class="material-symbols-outlined text-sm">check</span> Adicionado';
            button.classList.remove("bg-zinc-800");
            button.classList.add("bg-red-600");
            button.disabled = true;
          });
        });
      }

      function addMovieToList(movie) {
        const state = store.loadListState();
        const movieId = `tmdb-${movie.id}`;

        if (state.movies.some((item) => item.id === movieId)) {
          searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">info</span> Esse filme ja esta na sua lista.';
          return false;
        }

        state.movies.unshift({
          id: movieId,
          tmdbId: movie.id,
          title: movie.title,
          genre: "TMDB",
          year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : new Date().getFullYear(),
          rating: Number(movie.vote_average || 0) / 2,
          note: movie.overview || "Adicionado via busca do TMDB.",
          poster: window.TMDB.getImageUrl(movie.poster_path, SEARCH_PLACEHOLDER_POSTER)
        });
        state.updatedAt = new Date().toISOString();
        store.saveListState(state);
        searchStatus.innerHTML = `<span class="material-symbols-outlined text-base">check_circle</span> ${escapeHtml(movie.title)} foi adicionado a sua lista.`;
        return true;
      }

      function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Nao foi possivel ler o poster selecionado."));
          reader.readAsDataURL(file);
        });
      }

      async function handleManualMovieSubmit(event) {
        event.preventDefault();

        try {
          let posterUrl = SEARCH_PLACEHOLDER_POSTER;

          if (manualPosterFile) {
            if (window.CinefyStorage && typeof window.CinefyStorage.uploadUserImage === "function") {
              try {
                showManualFeedback("Enviando poster personalizado...", "success");
                posterUrl = await window.CinefyStorage.uploadUserImage(manualPosterFile, "posters");
              } catch (uploadError) {
                posterUrl = await readFileAsDataUrl(manualPosterFile);
                showManualFeedback("Poster salvo localmente. Assim que o Firebase Storage for configurado, o upload em nuvem sera usado.", "success");
              }
            } else {
              posterUrl = await readFileAsDataUrl(manualPosterFile);
            }
          }

          const customMovie = {
            id: `manual-${Date.now()}`,
            title: document.getElementById("manualTitleInput").value.trim(),
            genre: document.getElementById("manualGenreInput").value.trim(),
            year: Number(document.getElementById("manualYearInput").value),
            rating: Number(document.getElementById("manualRatingInput").value || 0),
            note: document.getElementById("manualNoteInput").value.trim() || "Adicionado manualmente na busca.",
            poster: posterUrl
          };

          const state = store.loadListState();
          state.movies.unshift(customMovie);
          state.updatedAt = new Date().toISOString();
          store.saveListState(state);

          manualMovieForm.reset();
          manualPosterFile = null;
          manualPosterInput.value = "";
          posterUploadFeedback.textContent = "Nenhum poster selecionado.";
          showManualFeedback(`${customMovie.title} foi adicionado manualmente a sua lista.`);
          searchStatus.innerHTML = `<span class="material-symbols-outlined text-base">check_circle</span> ${escapeHtml(customMovie.title)} foi adicionado manualmente a sua lista.`;
        } catch (error) {
          showManualFeedback(error.message || "Nao foi possivel salvar o filme manual agora.", "error");
        }
      }

      function setLoading(isLoading) {
        loadingState.classList.toggle("hidden", !isLoading);
        if (isLoading) {
          emptyState.classList.add("hidden");
        }
      }

      function handleSearchError(error) {
        console.error("Erro na busca TMDB:", error);
        resultsGrid.innerHTML = "";
        emptyState.classList.remove("hidden");
        resultsSubtitle.textContent = "Nao foi possivel carregar resultados";
        searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">error</span> Falha ao consultar o TMDB. Verifique a chave, CORS ou conexao.';
      }

      function handlePosterInputChange(event) {
        const [file] = event.target.files;
        if (!file) return;
        loadPosterFile(file);
      }

      function handlePosterDragOver(event) {
        event.preventDefault();
        posterUploadBox.classList.add("border-red-600");
      }

      function handlePosterDragLeave() {
        posterUploadBox.classList.remove("border-red-600");
      }

      function handlePosterDrop(event) {
        event.preventDefault();
        posterUploadBox.classList.remove("border-red-600");
        const [file] = Array.from(event.dataTransfer.files || []);
        if (!file) return;
        loadPosterFile(file);
      }

      function loadPosterFile(file) {
        if (!file.type.startsWith("image/")) {
          showManualFeedback("Selecione uma imagem PNG, JPG ou WEBP.", "error");
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          showManualFeedback("O poster precisa ter no maximo 5 MB.", "error");
          return;
        }

        manualPosterFile = file;
        posterUploadFeedback.textContent = `Poster selecionado: ${file.name}`;
        manualMovieFeedback.classList.add("hidden");
      }

      function showManualFeedback(message, type = "success") {
        manualMovieFeedback.textContent = message;
        manualMovieFeedback.classList.remove("hidden", "border-emerald-300/20", "bg-emerald-950/40", "text-emerald-100", "border-red-300/20", "bg-red-950/40", "text-red-100");
        if (type === "error") {
          manualMovieFeedback.classList.add("border-red-300/20", "bg-red-950/40", "text-red-100");
        } else {
          manualMovieFeedback.classList.add("border-emerald-300/20", "bg-emerald-950/40", "text-emerald-100");
        }
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
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function safePosterUrl(value) {
        const candidate = String(value || "").trim();
        if (!candidate) return SEARCH_PLACEHOLDER_POSTER;

        if (candidate.startsWith("data:image/") || candidate.startsWith("blob:")) {
          return candidate;
        }

        try {
          const parsedUrl = new URL(candidate, window.location.origin);
          if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
            return parsedUrl.href;
          }
        } catch (error) {
          return SEARCH_PLACEHOLDER_POSTER;
        }

        return SEARCH_PLACEHOLDER_POSTER;
      }

      function setView(view) {
        currentView = view === "list" ? "list" : "grid";
        localStorage.setItem(VIEW_STORAGE_KEY, currentView);
        applyViewMode();
        if (currentMovies.length) {
          renderMovies(currentMovies);
        }
      }

      function loadViewPreference() {
        try {
          const saved = localStorage.getItem(VIEW_STORAGE_KEY);
          return saved === "list" ? "list" : "grid";
        } catch (error) {
          return "grid";
        }
      }

      function applyViewMode() {
        resultsGrid.className = currentView === "list"
          ? "mt-6 grid grid-cols-1 gap-4"
          : "mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4";

        updateViewButtonState(gridViewButton, currentView === "grid");
        updateViewButtonState(listViewButton, currentView === "list");
      }

      function updateViewButtonState(button, isActive) {
        button.classList.toggle("bg-red-600", isActive);
        button.classList.toggle("border-red-500", isActive);
        button.classList.toggle("text-white", isActive);
        button.classList.toggle("text-zinc-400", !isActive);
      }

