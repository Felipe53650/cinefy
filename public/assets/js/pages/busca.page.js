const store = window.CinefyStore;
      const SEARCH_PLACEHOLDER_POSTER = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
      const VIEW_STORAGE_KEY = "cinefy-search-view";
      const runtimeCache = new Map();
      const certificationCache = new Map();
      let emptyStateDiscoveryPromise = null;
      const suggestedSearches = [
        { label: "Ação", query: "acao" },
        { label: "Ficção científica", query: "ficcao cientifica" },
        { label: "Terror", query: "terror" },
        { label: "Animação", query: "animacao" },
        { label: "Romance", query: "romance" }
      ];
      let currentView = loadViewPreference();
      let currentMovies = [];
      let sourceMovies = [];
      let appliedFilter = "az";

      const searchInput = document.getElementById("movieSearchInput");
      const searchButton = document.getElementById("movieSearchButton");
      const floatingSearchInput = document.getElementById("floatingMovieSearchInput");
      const floatingSearchButton = document.getElementById("floatingMovieSearchButton");
      const floatingSearchSprite = document.getElementById("floatingSearchSprite");
      const searchStatus = document.getElementById("searchStatus");
      const resultsSubtitle = document.getElementById("resultsSubtitle");
      const resultsGrid = document.getElementById("resultsGrid");
      const loadingState = document.getElementById("loadingState");
      const emptyState = document.getElementById("emptyState");
      const gridViewButton = document.getElementById("gridViewButton");
      const listViewButton = document.getElementById("listViewButton");
      const filterMenuButton = document.getElementById("filterMenuButton");
      const activeFilterLabel = document.getElementById("activeFilterLabel");
      const filterDropdownPanel = document.getElementById("filterDropdownPanel");
      const filterForm = document.getElementById("filterForm");
      const certificationFilterGroup = document.getElementById("certificationFilterGroup");
      const certificationFilterSelect = document.getElementById("certificationFilterSelect");
      const topbar = document.querySelector(".cinefy-topbar");
      const initialQuery = (() => {
        try {
          const params = new URLSearchParams(window.location.search);
          return String(params.get("q") || "").trim();
        } catch (error) {
          return "";
        }
      })();
      let lastScrollY = window.scrollY;
      let isCompactSearchVisible = false;
      let isFilterMenuOpen = false;

      searchButton.addEventListener("click", runSearch);
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearch();
        }
      });
      searchInput.addEventListener("input", () => syncSearchInputs(searchInput.value));
      floatingSearchButton.addEventListener("click", runSearchFromFloatingSprite);
      floatingSearchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          runSearchFromFloatingSprite();
        }
      });
      floatingSearchInput.addEventListener("input", () => syncSearchInputs(floatingSearchInput.value));
      gridViewButton.addEventListener("click", () => setView("grid"));
      listViewButton.addEventListener("click", () => setView("list"));
      filterMenuButton.addEventListener("click", toggleFilterMenu);
      filterForm.addEventListener("submit", handleApplyFilter);
      filterForm.addEventListener("change", handleFilterFormChange);
      document.addEventListener("click", handleOutsideFilterMenuClick);
      document.addEventListener("keydown", handleFilterMenuKeydown);
      window.addEventListener("cinefy:global-search", handleGlobalSearch);
      window.addEventListener("cinefy:list-updated", handleListUpdated);

      applyViewMode();
      updateFilterAuxControls();
      updateActiveFilterLabel();
      syncSearchInputs(initialQuery || searchInput.value);
      wireSearchHeaderBehavior();
      if (initialQuery) {
        runSearch(initialQuery);
      } else {
        renderIdleState();
      }

      async function runSearch(queryOverride) {
        const query = typeof queryOverride === "string" ? queryOverride.trim() : searchInput.value.trim();
        syncSearchInputs(query);
        syncGlobalSearchQuery(query);

        if (!query) {
          window.history.replaceState({}, "", "busca.html");
          renderIdleState();
          return;
        }

        try {
          setLoading(true);
          window.history.replaceState({}, "", `busca.html?q=${encodeURIComponent(query)}`);
          const movies = await window.TMDB.searchMovies(query);
          resultsSubtitle.textContent = `Resultados para "${escapeHtml(query)}"`;
          searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">search</span> Busca concluida no TMDB.';
          sourceMovies = movies;
          await applyCurrentFilter();
        } catch (error) {
          handleSearchError(error);
        } finally {
          setLoading(false);
        }
      }

      function runSearchFromFloatingSprite() {
        runSearch(floatingSearchInput.value);
      }

      function handleGlobalSearch(event) {
        const query = event && event.detail ? String(event.detail.query || "") : "";
        runSearch(query);
      }

      function handleListUpdated() {
        if (currentMovies.length) {
          renderMovies(currentMovies);
        }
      }

      function renderMovies(movies) {
        currentMovies = movies;
        if (!movies.length) {
          resultsGrid.innerHTML = "";
          emptyState.innerHTML = `
            <span class="material-symbols-outlined text-5xl text-zinc-500">movie_off</span>
            <p class="mt-4 font-bold text-zinc-200">Nenhum filme encontrado.</p>
            <p class="mt-2 text-zinc-500">Tente outro titulo ou ajuste o filtro aplicado.</p>
            ${buildSuggestedSearchMarkup("Tente um destes caminhos rapidos")}
            <div class="empty-discovery-shell hidden" id="emptyDiscoveryMount"></div>
          `;
          emptyState.classList.remove("hidden");
          bindSuggestedSearchButtons();
          enrichEmptyStateWithDiscovery();
          return;
        }

        applyViewMode();
        emptyState.classList.add("hidden");
        resultsGrid.innerHTML = movies.map((movie) => {
          const releaseYear = movie.release_date ? movie.release_date.slice(0, 4) : "Sem ano";
          const rating = typeof movie.vote_average === "number" ? movie.vote_average.toFixed(1) : "N/A";
          const reviewCount = formatVoteCountSuffix(movie.vote_count);
          const isInList = isMovieInUserList(movie);
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
          const certificationMarkup = movie.certificationLabel
            ? `<span class="cinefy-metadata-pill cinefy-metadata-pill--strong">${escapeHtml(movie.certificationLabel)}</span>`
            : "";

          return `
            <article class="${articleClass}">
              <div class="${mediaClass}">
                <img alt="${escapeHtml(movie.title)}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" decoding="async" loading="lazy" src="${escapeAttribute(safePosterUrl(poster))}" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"></div>
              ${isInList ? `
                <div class="absolute left-3 top-3">
                  <span class="cinefy-in-list-badge px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]">
                    <span class="material-symbols-outlined fill-icon text-[13px]">check_circle</span>
                    Na lista
                  </span>
                </div>
              ` : ""}
                <div class="absolute right-3 top-3">
                  <span class="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                    <span class="material-symbols-outlined fill-icon text-[13px] text-yellow-400">star</span>${rating}${reviewCount}
                  </span>
                </div>
              </div>
              <div class="${contentClass}">
                <div>
                  <h4 class="text-base font-bold text-white ${currentView === "list" ? "" : "line-clamp-1"}">${escapeHtml(movie.title)}</h4>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span class="cinefy-metadata-pill">${releaseYear}</span>
                    ${certificationMarkup}
                  </div>
                  <p class="mt-3 text-sm leading-relaxed text-zinc-400 ${currentView === "list" ? "line-clamp-4" : "line-clamp-3"}">${escapeHtml(movie.overview || "Sem sinopse disponivel no TMDB.")}</p>
                </div>
                <div class="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <a class="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]" href="detalhes.html?id=${encodeURIComponent(String(movie.id || ""))}">
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                    Detalhes
                  </a>
                  <button class="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition ${isInList ? "bg-red-600" : "bg-zinc-800 hover:bg-red-600"}" data-add-movie="${escapeAttribute(JSON.stringify(movie))}" type="button" ${isInList ? "disabled" : ""}>
                    <span class="material-symbols-outlined text-sm">${isInList ? "check" : "add"}</span>
                    ${isInList ? "Adicionado" : "Minha Lista"}
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

      async function handleApplyFilter(event) {
        event.preventDefault();
        appliedFilter = loadSelectedFilter();
        updateFilterAuxControls();
        await applyCurrentFilter();
        setFilterMenuVisibility(false);
      }

      function handleFilterFormChange(event) {
        if (event.target && event.target.name === "searchSortFilter") {
          updateFilterAuxControls();
        }
      }

      function setLoading(isLoading) {
        loadingState.classList.toggle("hidden", !isLoading);
        if (isLoading) {
          emptyState.classList.add("hidden");
        }
      }

      function renderIdleState() {
        sourceMovies = [];
        currentMovies = [];
        resultsGrid.innerHTML = "";
        loadingState.classList.add("hidden");
        emptyState.classList.remove("hidden");
        emptyState.innerHTML = `
          <span class="material-symbols-outlined text-5xl text-zinc-500">search</span>
          <p class="mt-4 font-bold text-zinc-200">Digite um filme para comecar a busca.</p>
          <p class="mt-2 text-zinc-500">Os resultados aparecem aqui assim que voce pesquisar no catalogo do TMDB.</p>
          ${buildSuggestedSearchMarkup("Ou comece por um genero popular")}
          <div class="empty-discovery-shell hidden" id="emptyDiscoveryMount"></div>
        `;
        resultsSubtitle.textContent = "Aguardando sua pesquisa";
        searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">search</span> Pesquise por titulo ou escolha um genero para entrar no catalogo mais rapido.';
        syncGlobalSearchQuery("");
        bindSuggestedSearchButtons();
        enrichEmptyStateWithDiscovery();
      }

      function handleSearchError(error) {
        console.error("Erro na busca TMDB:", error);
        resultsGrid.innerHTML = "";
        emptyState.classList.remove("hidden");
        emptyState.innerHTML = `
          <span class="material-symbols-outlined text-5xl text-zinc-500">movie_off</span>
          <p class="mt-4 font-bold text-zinc-200">Nenhum filme encontrado.</p>
          <p class="mt-2 text-zinc-500">Tente outro titulo ou ajuste o filtro aplicado.</p>
          ${buildSuggestedSearchMarkup("Se preferir, tente um genero em destaque")}
          <div class="empty-discovery-shell hidden" id="emptyDiscoveryMount"></div>
        `;
        resultsSubtitle.textContent = "Nao foi possivel carregar resultados";
        searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">error</span> Nao foi possivel carregar resultados agora. Tente novamente em instantes.';
        bindSuggestedSearchButtons();
        enrichEmptyStateWithDiscovery();
      }

      function buildSuggestedSearchMarkup(kicker) {
        return `
          <div class="mt-6 flex flex-col items-center gap-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">${escapeHtml(kicker)}</p>
            <div class="flex flex-wrap justify-center gap-2">
              ${suggestedSearches.map((item) => `
                <button
                  class="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-red-500/35 hover:bg-white/[0.09] hover:text-white"
                  data-suggested-search="${escapeAttribute(item.query)}"
                  type="button"
                >
                  ${escapeHtml(item.label)}
                </button>
              `).join("")}
            </div>
          </div>
        `;
      }

      function bindSuggestedSearchButtons() {
        emptyState.querySelectorAll("[data-suggested-search]").forEach((button) => {
          button.addEventListener("click", () => {
            const query = String(button.dataset.suggestedSearch || "").trim();
            if (!query) return;
            runSearch(query);
          });
        });
      }

      async function enrichEmptyStateWithDiscovery() {
        const mount = document.getElementById("emptyDiscoveryMount");
        if (!mount) return;

        mount.classList.remove("hidden");
        mount.innerHTML = `
          <div class="empty-discovery-loading">
            <span class="material-symbols-outlined text-3xl text-zinc-500">progress_activity</span>
            <p class="text-sm font-semibold text-zinc-400">Montando uma faixa para voce descobrir algo agora.</p>
          </div>
        `;

        try {
          const payload = await loadEmptyStateDiscovery();
          const currentMount = document.getElementById("emptyDiscoveryMount");
          if (!currentMount) return;

          currentMount.innerHTML = `
            <div class="empty-discovery-header">
              <div class="section-heading">
                <h4 class="text-lg font-bold text-white">${escapeHtml(payload.title)}</h4>
                <p class="text-sm text-zinc-400">${escapeHtml(payload.subtitle)}</p>
              </div>
            </div>
            <div class="empty-discovery-track">
              ${payload.movies.map((movie) => buildEmptyDiscoveryCard(movie)).join("")}
            </div>
          `;
        } catch (error) {
          const currentMount = document.getElementById("emptyDiscoveryMount");
          if (!currentMount) return;
          currentMount.innerHTML = "";
          currentMount.classList.add("hidden");
        }
      }

      function buildEmptyDiscoveryCard(movie) {
        const year = movie.release_date ? String(movie.release_date).slice(0, 4) : "Sem ano";
        const rating = typeof movie.vote_average === "number" ? movie.vote_average.toFixed(1) : "N/A";
        const reviewCount = formatVoteCountSuffix(movie.vote_count);
        const poster = safePosterUrl(window.TMDB.getImageUrl(movie.poster_path, SEARCH_PLACEHOLDER_POSTER));

        return `
          <article class="empty-discovery-card">
            <a class="empty-discovery-card__poster" href="detalhes.html?id=${encodeURIComponent(String(movie.id || ""))}">
              <img alt="${escapeHtml(movie.title)}" decoding="async" loading="lazy" src="${escapeAttribute(poster)}" />
              <span class="empty-discovery-card__rating">
                <span class="material-symbols-outlined fill-icon text-[13px] text-yellow-400">star</span>
                ${rating}${reviewCount}
              </span>
            </a>
            <div class="empty-discovery-card__body">
              <h5 class="line-clamp-1 text-sm font-bold text-white">${escapeHtml(movie.title)}</h5>
              <p class="mt-1 text-xs text-zinc-400">${escapeHtml(year)}</p>
            </div>
          </article>
        `;
      }

      async function loadEmptyStateDiscovery() {
        if (!emptyStateDiscoveryPromise) {
          emptyStateDiscoveryPromise = buildEmptyStateDiscovery().catch((error) => {
            emptyStateDiscoveryPromise = null;
            throw error;
          });
        }

        return emptyStateDiscoveryPromise;
      }

      async function buildEmptyStateDiscovery() {
        const personalized = await buildLightweightPersonalizedRecommendations();
        if (personalized.length >= 4) {
          return {
            title: "Recomendado para voce",
            subtitle: "Escolhas puxadas do seu historico no Cinefy Club para facilitar a descoberta.",
            movies: personalized.slice(0, 8)
          };
        }

        const topRated = await window.TMDB.getTopRatedMovies();
        return {
          title: "Muito bem avaliados agora",
          subtitle: "Uma faixa pronta para voce entrar no catalogo sem partir de uma busca em branco.",
          movies: topRated.slice(0, 8)
        };
      }

      async function buildLightweightPersonalizedRecommendations() {
        const listState = store.loadListState();
        const reviews = store.loadReviews();
        const savedMovies = Array.isArray(listState.movies) ? listState.movies : [];
        const savedTmdbIds = new Set(
          savedMovies
            .map((movie) => String(movie.tmdbId || "").trim())
            .filter(Boolean)
        );

        const seedScores = new Map();

        savedMovies.forEach((movie) => {
          const tmdbId = String(movie.tmdbId || "").trim();
          if (!tmdbId) return;

          const baseScore = 1 + Math.max(0, Number(movie.rating || 0)) * 0.32;
          seedScores.set(tmdbId, (seedScores.get(tmdbId) || 0) + baseScore);
        });

        Object.entries(reviews || {}).forEach(([key, review]) => {
          const match = /^tmdb-(\d+)$/.exec(String(key || ""));
          if (!match) return;

          const tmdbId = match[1];
          const rating = Number(review && review.rating);
          if (!Number.isFinite(rating) || rating < 3.5) return;

          const commentBoost = review && review.comment ? Math.min(review.comment.length / 160, 0.6) : 0;
          seedScores.set(tmdbId, (seedScores.get(tmdbId) || 0) + 1.3 + rating * 0.45 + commentBoost);
        });

        const seeds = [...seedScores.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        if (!seeds.length) {
          return [];
        }

        const recommendationBuckets = await Promise.allSettled(
          seeds.map(async ([tmdbId, weight]) => {
            const movies = await window.TMDB.getMovieRecommendations(tmdbId);
            return { weight, movies };
          })
        );

        const combined = new Map();

        recommendationBuckets
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .forEach(({ weight, movies }) => {
            movies.forEach((movie, index) => {
              if (!movie || !movie.id) return;
              if (savedTmdbIds.has(String(movie.id))) return;

              const score = weight + Math.max(0, 10 - index) * 0.18 + Number(movie.vote_average || 0) * 0.14;
              const existing = combined.get(movie.id);
              if (!existing || score > existing.score) {
                combined.set(movie.id, { movie, score });
              }
            });
          });

        return [...combined.values()]
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.movie);
      }

      function syncSearchInputs(value) {
        const nextValue = String(value || "");
        if (searchInput && searchInput.value !== nextValue) {
          searchInput.value = nextValue;
        }
        if (floatingSearchInput && floatingSearchInput.value !== nextValue) {
          floatingSearchInput.value = nextValue;
        }
        syncGlobalSearchQuery(nextValue);
      }

      function syncGlobalSearchQuery(value) {
        window.dispatchEvent(new CustomEvent("cinefy:search-query-updated", {
          detail: { query: String(value || "") }
        }));
      }

      function wireSearchHeaderBehavior() {
        if (!topbar || !floatingSearchSprite) return;

        updateSearchChrome(window.scrollY);
        window.addEventListener("scroll", handleSearchScroll, { passive: true });
      }

      function handleSearchScroll() {
        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > lastScrollY;
        const hasMovedEnough = Math.abs(currentScrollY - lastScrollY) > 10;

        if (!hasMovedEnough) {
          return;
        }

        if (currentScrollY <= 72) {
          setCompactSearchVisibility(false);
        } else if (scrollingDown && currentScrollY > 140) {
          setCompactSearchVisibility(true);
        } else if (!scrollingDown) {
          setCompactSearchVisibility(false);
        }

        lastScrollY = currentScrollY;
      }

      function updateSearchChrome(scrollY) {
        setCompactSearchVisibility(scrollY > 140);
        lastScrollY = scrollY;
      }

      function setCompactSearchVisibility(isVisible) {
        if (isCompactSearchVisible === isVisible) return;

        document.body.classList.toggle("busca-compact-search-active", isVisible);
        isCompactSearchVisible = isVisible;
      }

      function toggleFilterMenu() {
        setFilterMenuVisibility(!isFilterMenuOpen);
      }

      function setFilterMenuVisibility(isVisible) {
        if (!filterDropdownPanel || !filterMenuButton) return;

        isFilterMenuOpen = isVisible;
        filterDropdownPanel.classList.toggle("hidden", !isVisible);
        filterMenuButton.classList.toggle("is-open", isVisible);
        filterMenuButton.setAttribute("aria-expanded", String(isVisible));
      }

      function handleOutsideFilterMenuClick(event) {
        if (!isFilterMenuOpen) return;
        if (filterDropdownPanel.contains(event.target) || filterMenuButton.contains(event.target)) {
          return;
        }
        setFilterMenuVisibility(false);
      }

      function handleFilterMenuKeydown(event) {
        if (event.key !== "Escape") return;
        setFilterMenuVisibility(false);
      }

      async function applyCurrentFilter() {
        const normalizedFilter = appliedFilter || "az";
        const movies = Array.isArray(sourceMovies) ? [...sourceMovies] : [];

        if (!movies.length) {
          currentMovies = [];
          renderMovies([]);
          return;
        }

        if (normalizedFilter === "runtime") {
          searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">filter_alt</span> Buscando duracao dos filmes para ordenar.';
          await hydrateMoviesWithRuntime(movies);
        }

        if (normalizedFilter === "certification") {
          searchStatus.innerHTML = '<span class="material-symbols-outlined text-base">filter_alt</span> Carregando classificacao etaria dos filmes.';
          await hydrateMoviesWithCertification(movies);
        }

        currentMovies = sortMoviesByFilter(movies, normalizedFilter);
        renderMovies(currentMovies);
        updateActiveFilterLabel();
        searchStatus.innerHTML = `<span class="material-symbols-outlined text-base">filter_alt</span> Filtro aplicado: ${escapeHtml(getFilterLabel(normalizedFilter))}.`;
      }

      async function hydrateMoviesWithRuntime(movies) {
        await Promise.all(movies.map(async (movie) => {
          if (!movie || !movie.id || runtimeCache.has(movie.id)) {
            if (movie && movie.id && runtimeCache.has(movie.id)) {
              movie.runtime = runtimeCache.get(movie.id);
            }
            return;
          }

          try {
            const details = await window.TMDB.getMovieDetails(movie.id);
            const runtime = Number(details && details.runtime) || 0;
            runtimeCache.set(movie.id, runtime);
            movie.runtime = runtime;
          } catch (error) {
            runtimeCache.set(movie.id, 0);
            movie.runtime = 0;
          }
        }));
      }

      async function hydrateMoviesWithCertification(movies) {
        await Promise.all(movies.map(async (movie) => {
          if (!movie || !movie.id || certificationCache.has(movie.id)) {
            if (movie && movie.id && certificationCache.has(movie.id)) {
              movie.certificationLabel = certificationCache.get(movie.id);
            }
            return;
          }

          try {
            const releaseDates = await window.TMDB.getMovieReleaseDates(movie.id);
            const certificationLabel = extractMovieCertificationLabel(releaseDates);
            certificationCache.set(movie.id, certificationLabel);
            movie.certificationLabel = certificationLabel;
          } catch (error) {
            certificationCache.set(movie.id, "");
            movie.certificationLabel = "";
          }
        }));
      }

      function sortMoviesByFilter(movies, filter) {
        switch (filter) {
          case "popular":
            return movies.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
          case "year":
            return movies.sort((a, b) => getMovieYear(b) - getMovieYear(a));
          case "runtime":
            return movies.sort((a, b) => Number(b.runtime || runtimeCache.get(b.id) || 0) - Number(a.runtime || runtimeCache.get(a.id) || 0));
          case "certification":
            return filterMoviesByCertification(movies);
          case "rating-desc":
            return movies.sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));
          case "rating-asc":
            return movies.sort((a, b) => Number(a.vote_average || 0) - Number(b.vote_average || 0));
          case "az":
          default:
            return movies.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR", { sensitivity: "base" }));
        }
      }

      function loadSelectedFilter() {
        const selectedOption = filterForm.querySelector('input[name="searchSortFilter"]:checked');
        return selectedOption ? selectedOption.value : "az";
      }

      function getFilterLabel(filter) {
        switch (filter) {
          case "popular":
            return "Mais populares";
          case "year":
            return "Ano";
          case "runtime":
            return "Duracao";
          case "certification":
            return `Classificacao etaria${getSelectedCertificationLabel() === "Qualquer classificação" ? "" : `: ${getSelectedCertificationLabel()}`}`;
          case "rating-desc":
            return "Melhor avaliacao";
          case "rating-asc":
            return "Pior avaliacao";
          case "az":
          default:
            return "A - Z";
        }
      }

      function updateActiveFilterLabel() {
        if (!activeFilterLabel) return;
        activeFilterLabel.textContent = `Filtro aplicado: ${getFilterLabel(appliedFilter)}`;
      }

      function updateFilterAuxControls() {
        if (!certificationFilterGroup) return;
        certificationFilterGroup.classList.toggle("hidden", loadSelectedFilter() !== "certification");
      }

      function getSelectedCertificationLabel() {
        const value = certificationFilterSelect ? certificationFilterSelect.value : "all";
        if (value === "all") return "Qualquer classificação";
        return value;
      }

      function filterMoviesByCertification(movies) {
        const certificationValue = certificationFilterSelect ? certificationFilterSelect.value : "all";
        const filteredMovies = certificationValue === "all"
          ? movies
          : movies.filter((movie) => String(movie.certificationLabel || "").trim() === certificationValue);

        return filteredMovies.sort((a, b) =>
          String(a.title || "").localeCompare(String(b.title || ""), "pt-BR", { sensitivity: "base" })
        );
      }

      function extractMovieCertificationLabel(releaseDatesPayload) {
        const results = Array.isArray(releaseDatesPayload && releaseDatesPayload.results)
          ? releaseDatesPayload.results
          : [];
        const prioritizedEntries = [
          results.find((item) => item.iso_3166_1 === "BR"),
          results.find((item) => item.iso_3166_1 === "US"),
          ...results
        ].filter(Boolean);

        for (const entry of prioritizedEntries) {
          const releaseDates = Array.isArray(entry.release_dates) ? entry.release_dates : [];
          for (const releaseDate of releaseDates) {
            const normalizedCertification = normalizeCertificationLabel(releaseDate.certification, entry.iso_3166_1);
            if (normalizedCertification) {
              return normalizedCertification;
            }
          }
        }

        return "";
      }

      function normalizeCertificationLabel(value, countryCode) {
        const rawValue = String(value || "").trim().toUpperCase();
        if (!rawValue) return "";

        if (countryCode === "BR") {
          if (rawValue === "L" || rawValue === "LIVRE") return "L";
          if (["10", "12", "14", "16", "18"].includes(rawValue)) return rawValue;
        }

        if (rawValue === "G" || rawValue === "TV-G" || rawValue === "L") return "L";
        if (rawValue === "PG" || rawValue === "TV-PG" || rawValue === "10") return "10";
        if (rawValue === "PG-13" || rawValue === "TV-14" || rawValue === "12" || rawValue === "13") return "12";
        if (rawValue === "14") return "14";
        if (rawValue === "15" || rawValue === "16" || rawValue === "M") return "16";
        if (rawValue === "17" || rawValue === "18" || rawValue === "R" || rawValue === "NC-17" || rawValue === "TV-MA") return "18";

        const numericValue = Number(rawValue.replace(/[^\d]/g, ""));
        if (!Number.isFinite(numericValue)) return "";
        if (numericValue <= 0) return "L";
        if (numericValue <= 10) return "10";
        if (numericValue <= 12) return "12";
        if (numericValue <= 14) return "14";
        if (numericValue <= 16) return "16";
        return "18";
      }

      function getMovieYear(movie) {
        if (!movie || !movie.release_date) return 0;
        return Number(String(movie.release_date).slice(0, 4)) || 0;
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

      function formatVoteCountSuffix(value) {
        if (!window.TMDB || typeof window.TMDB.formatVoteCount !== "function") {
          return "";
        }

        const formatted = window.TMDB.formatVoteCount(value);
        return formatted ? ` (${formatted})` : "";
      }

      function isMovieInUserList(movie) {
        const state = store.loadListState();
        const tmdbId = String(movie && movie.id ? movie.id : "").trim();
        if (!tmdbId || !state || !Array.isArray(state.movies)) {
          return false;
        }

        return state.movies.some((item) =>
          String(item.tmdbId || "").trim() === tmdbId ||
          String(item.id || "").trim() === `tmdb-${tmdbId}`
        );
      }

      function safePosterUrl(value) {
        const candidate = String(value || "").trim();
        if (!candidate) return SEARCH_PLACEHOLDER_POSTER;

        if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
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
          : "mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5";

        updateViewButtonState(gridViewButton, currentView === "grid");
        updateViewButtonState(listViewButton, currentView === "list");
      }

      function updateViewButtonState(button, isActive) {
        button.classList.toggle("bg-red-600", isActive);
        button.classList.toggle("border-red-500", isActive);
        button.classList.toggle("text-white", isActive);
        button.classList.toggle("text-zinc-400", !isActive);
      }

