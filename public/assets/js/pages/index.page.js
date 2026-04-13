const store = window.CinefyStore;
    const fallbackPoster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
    let heroMovie = null;
    const heroListButton = document.getElementById("heroListButton");
    const heroListButtonIcon = document.getElementById("heroListButtonIcon");
    const heroListButtonLabel = document.getElementById("heroListButtonLabel");
    const homeFeedback = document.getElementById("homeFeedback");
    const recommendationsSubtitle = document.getElementById("recommendationsSubtitle");

    heroListButton.addEventListener("click", toggleHeroMovieInList);
    window.addEventListener("cinefy:list-updated", handleListUpdated);
    window.addEventListener("cinefy:reviews-updated", handleReviewsUpdated);

    loadHome();

    async function loadHome() {
      try {
        const [featured, topRated] = await Promise.all([
          window.TMDB.getTrendingMovies(),
          window.TMDB.getTopRatedMovies()
        ]);

        const myList = store.loadListState().movies;
        heroMovie = featured[0] || null;

        if (heroMovie) {
          renderHero(heroMovie);
        } else {
          syncHeroListButtonState();
        }

        store.syncCatalogNotifications(featured.slice(0, 10));
        renderMovieScroller("featuredScroller", featured.slice(0, 12));
        renderMovieScroller("topRatedScroller", topRated.slice(0, 12));
        await renderRecommendedScroller();
        renderMyListScroller(myList);
      } catch (error) {
        console.error("Erro ao carregar a home do TMDB:", error);
        document.getElementById("heroTitle").textContent = "Nao foi possivel carregar o catalogo agora";
        document.getElementById("heroOverview").textContent = "Tente novamente em instantes enquanto restabelecemos a consulta dos filmes.";
      }
    }

    function renderHero(movie) {
      document.getElementById("heroBackdrop").src = window.TMDB.getBackdropUrl(movie.backdrop_path, fallbackPoster);
      document.getElementById("heroTitle").textContent = movie.title;
      document.getElementById("heroOverview").textContent = movie.overview || "Sem sinopse disponivel.";
      updateHeroMetaPrimary(movie);
      document.getElementById("heroDetailsLink").href = `detalhes.html?id=${movie.id}`;
      syncHeroListButtonState();
      hydrateHeroCertification(movie);
    }

    function updateHeroMetaPrimary(movie) {
      const parts = [formatYear(movie.release_date)];
      if (movie.certificationLabel) {
        parts.push(movie.certificationLabel);
      }
      parts.push(`Nota ${formatRating(movie.vote_average)}${formatVoteCountSuffix(movie.vote_count)}`);
      document.getElementById("heroMetaPrimary").textContent = parts.join(" • ");
    }

    function renderMovieScroller(containerId, movies) {
      const container = document.getElementById(containerId);
      container.innerHTML = buildMovieScrollerMarkup(movies);
      hydrateMovieCertifications(movies).then((hasUpdates) => {
        if (hasUpdates) {
          container.innerHTML = buildMovieScrollerMarkup(movies);
        }
      });
    }

    function buildMovieScrollerMarkup(movies) {
      return movies.map((movie) => `
        <article class="group min-w-[160px] max-w-[160px] sm:min-w-[190px] sm:max-w-[190px] md:min-w-[250px] md:max-w-[250px]">
          <a class="block" href="detalhes.html?id=${encodeURIComponent(String(movie.id || ""))}">
            <div class="relative mb-4 aspect-[2/3] overflow-hidden rounded-[1.6rem] border border-white/10 bg-zinc-900 shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
              <img alt="${escapeHtml(movie.title)}" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" decoding="async" loading="lazy" src="${escapeAttribute(safeMediaUrl(window.TMDB.getImageUrl(movie.poster_path, fallbackPoster)))}" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-90"></div>
              <div class="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                <span class="material-symbols-outlined fill-icon text-sm text-yellow-400">star</span>
                ${formatRating(movie.vote_average)}${formatVoteCountSuffix(movie.vote_count)}
              </div>
              <div class="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
                <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
                  ${formatYear(movie.release_date)}
                </span>
                ${movie.certificationLabel ? `<span class="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-100 backdrop-blur-sm">${escapeHtml(movie.certificationLabel)}</span>` : ""}
              </div>
            </div>
            <h3 class="line-clamp-1 text-base font-bold text-white transition group-hover:text-red-300">${escapeHtml(movie.title)}</h3>
          </a>
        </article>
      `).join("");
    }

    function renderMyListScroller(movies) {
      const container = document.getElementById("myListScroller");

      if (!movies.length) {
        container.innerHTML = `
          <div class="w-full rounded-[1.75rem] border border-dashed border-zinc-700 bg-zinc-950/50 p-8 text-center">
            <p class="text-lg font-bold text-white">Sua lista ainda esta vazia.</p>
            <p class="mt-2 text-zinc-400">Use a busca para adicionar filmes e montar sua propria vitrine de cinema.</p>
            <a class="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-black transition hover:bg-zinc-200" href="busca.html">
              <span class="material-symbols-outlined">search</span>
              Buscar filmes
            </a>
          </div>
        `;
        return;
      }

      container.innerHTML = movies.map((movie) => {
        const tmdbId = movie.tmdbId || String(movie.id || "").replace(/^tmdb-/, "");
        const detailsHref = tmdbId
          ? `detalhes.html?id=${encodeURIComponent(String(tmdbId))}`
          : `detalhes.html?local=${encodeURIComponent(String(movie.id || ""))}`;
        return `
          <article class="group min-w-[160px] max-w-[160px] sm:min-w-[190px] sm:max-w-[190px] md:min-w-[250px] md:max-w-[250px]">
            <a class="block" href="${escapeAttribute(detailsHref)}">
              <div class="relative mb-4 aspect-[2/3] overflow-hidden rounded-[1.6rem] border border-white/10 bg-zinc-900 shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
                <img alt="${escapeHtml(movie.title)}" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" decoding="async" loading="lazy" src="${escapeAttribute(safeMediaUrl(movie.poster || fallbackPoster))}" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent"></div>
                <div class="absolute bottom-3 left-3 right-3 rounded-[1rem] border border-white/10 bg-black/45 px-3 py-2 text-xs text-zinc-200 backdrop-blur-md">
                  ${escapeHtml(movie.genre || "Filme")} • ${escapeHtml(String(movie.year || "Sem ano"))}
                </div>
              </div>
              <h3 class="line-clamp-1 text-base font-bold text-white transition group-hover:text-red-300">${escapeHtml(movie.title)}</h3>
              <p class="mt-1 line-clamp-2 text-sm text-zinc-400">${escapeHtml(movie.note || "Adicionado a sua lista")}</p>
            </a>
          </article>
        `;
      }).join("");
    }

    async function renderRecommendedScroller() {
      const container = document.getElementById("recommendedScroller");
      if (!container) return;

      try {
        const recommendations = await buildPersonalizedRecommendations();

        if (!recommendations.length) {
          recommendationsSubtitle.textContent = "Avalie ou adicione filmes para desbloquear sugestoes personalizadas.";
          container.innerHTML = `
            <div class="w-full rounded-[1.75rem] border border-dashed border-zinc-700 bg-zinc-950/50 p-8 text-center">
              <p class="text-lg font-bold text-white">Sua home aprende com voce.</p>
              <p class="mt-2 text-zinc-400">Salve filmes na lista ou avalie alguns titulos para eu sugerir proximos passos com mais personalidade.</p>
              <a class="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-black transition hover:bg-zinc-200" href="busca.html">
                <span class="material-symbols-outlined">search</span>
                Explorar catalogo
              </a>
            </div>
          `;
          return;
        }

        recommendationsSubtitle.textContent = "Sugestoes geradas com base nas suas notas mais altas e nos filmes da sua lista.";
        renderMovieScroller("recommendedScroller", recommendations.slice(0, 12));
      } catch (error) {
        console.error("Erro ao montar recomendacoes personalizadas:", error);
        recommendationsSubtitle.textContent = "Nao foi possivel montar recomendacoes agora.";
        container.innerHTML = `
          <div class="w-full rounded-[1.75rem] border border-dashed border-zinc-700 bg-zinc-950/50 p-8 text-center">
            <p class="text-lg font-bold text-white">As recomendacoes nao puderam ser carregadas.</p>
            <p class="mt-2 text-zinc-400">Tente novamente daqui a pouco enquanto consultamos o TMDB.</p>
          </div>
        `;
      }
    }

    async function buildPersonalizedRecommendations() {
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

        const baseScore = 1.2 + Math.max(0, Number(movie.rating || 0)) * 0.35;
        const noteBoost = movie.note ? Math.min(movie.note.length / 120, 0.55) : 0;
        seedScores.set(tmdbId, (seedScores.get(tmdbId) || 0) + baseScore + noteBoost);
      });

      Object.entries(reviews || {}).forEach(([key, review]) => {
        const match = /^tmdb-(\d+)$/.exec(String(key || ""));
        if (!match) return;

        const tmdbId = match[1];
        const rating = Number(review && review.rating);
        const commentBoost = review && review.comment ? Math.min(review.comment.length / 140, 0.75) : 0;
        const normalizedRating = Number.isFinite(rating) ? rating : 0;
        const reviewScore = normalizedRating >= 4
          ? 2 + normalizedRating * 0.6 + commentBoost
          : normalizedRating >= 3
            ? 0.9 + normalizedRating * 0.25 + commentBoost * 0.5
            : 0;

        if (reviewScore > 0) {
          seedScores.set(tmdbId, (seedScores.get(tmdbId) || 0) + reviewScore);
        }
      });

      const sortedSeeds = [...seedScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      if (!sortedSeeds.length) {
        return [];
      }

      const recommendationBuckets = await Promise.allSettled(
        sortedSeeds.map(async ([tmdbId, weight]) => {
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

          const positionScore = Math.max(0, 12 - index) * 0.22;
          const ratingScore = Number(movie.vote_average || 0) * 0.16;
          const recencyScore = getReleaseRecencyScore(movie.release_date);
          const totalScore = weight + positionScore + ratingScore + recencyScore;
          const existing = combined.get(movie.id);

          if (!existing || totalScore > existing.score) {
            combined.set(movie.id, {
              movie,
              score: totalScore
            });
          }
        });
      });

      return [...combined.values()]
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.movie);
    }

    async function hydrateMovieCertifications(movies) {
      if (!window.TMDB || typeof window.TMDB.getMovieCertificationLabel !== "function") {
        return false;
      }

      let hasUpdates = false;

      await Promise.all((Array.isArray(movies) ? movies : []).map(async (movie) => {
        if (!movie || !movie.id || movie.certificationLabel) {
          return;
        }

        try {
          const certificationLabel = await window.TMDB.getMovieCertificationLabel(movie.id);
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

    async function hydrateHeroCertification(movie) {
      if (!movie || !movie.id || movie.certificationLabel) {
        updateHeroMetaPrimary(movie || {});
        return;
      }

      if (!window.TMDB || typeof window.TMDB.getMovieCertificationLabel !== "function") {
        return;
      }

      try {
        const certificationLabel = await window.TMDB.getMovieCertificationLabel(movie.id);
        if (certificationLabel) {
          movie.certificationLabel = certificationLabel;
          if (heroMovie && String(heroMovie.id) === String(movie.id)) {
            updateHeroMetaPrimary(movie);
          }
        }
      } catch (error) {
        movie.certificationLabel = "";
      }
    }

    function toggleHeroMovieInList() {
      if (!heroMovie) return;

      const state = store.loadListState();
      const existingEntry = getHeroMovieEntry(state);

      if (existingEntry) {
        state.movies = state.movies.filter((item) => item.id !== existingEntry.id);
        state.updatedAt = new Date().toISOString();
        store.saveListState(state);
        renderMyListScroller(state.movies);
        homeFeedback.textContent = `${heroMovie.title} foi removido da sua lista.`;
        syncHeroListButtonState(state);
        return;
      }

      state.movies.unshift({
        id: `tmdb-${heroMovie.id}`,
        tmdbId: heroMovie.id,
        title: heroMovie.title,
        genre: "TMDB",
        year: formatYear(heroMovie.release_date),
        rating: Number(heroMovie.vote_average || 0) / 2,
        note: heroMovie.overview || "Adicionado pela home.",
        poster: window.TMDB.getImageUrl(heroMovie.poster_path, fallbackPoster)
      });
      state.updatedAt = new Date().toISOString();
      store.saveListState(state);
      renderMyListScroller(state.movies);
      homeFeedback.textContent = `${heroMovie.title} foi adicionado a sua lista.`;
      syncHeroListButtonState(state);
    }

    function getHeroMovieEntry(state = store.loadListState()) {
      if (!heroMovie || !state || !Array.isArray(state.movies)) {
        return null;
      }

      return state.movies.find((item) => item.id === `tmdb-${heroMovie.id}` || String(item.tmdbId) === String(heroMovie.id)) || null;
    }

    function syncHeroListButtonState(state = store.loadListState()) {
      const isAdded = Boolean(getHeroMovieEntry(state));

      heroListButton.classList.toggle("is-added", isAdded);
      heroListButton.setAttribute("aria-pressed", isAdded ? "true" : "false");
      heroListButton.disabled = !heroMovie;
      heroListButtonIcon.textContent = isAdded ? "check" : "add";
      heroListButtonLabel.textContent = isAdded ? "Adicionado" : "Adicionar a Minha Lista";
    }

    function handleListUpdated(event) {
      const state = event && event.detail && Array.isArray(event.detail.movies)
        ? event.detail
        : store.loadListState();

      renderMyListScroller(state.movies || []);
      syncHeroListButtonState(state);
      renderRecommendedScroller();
    }

    function handleReviewsUpdated() {
      renderRecommendedScroller();
    }

    function formatYear(releaseDate) {
      return releaseDate ? String(releaseDate).slice(0, 4) : "Sem ano";
    }

    function formatRating(voteAverage) {
      return typeof voteAverage === "number" ? voteAverage.toFixed(1) : "N/A";
    }

    function formatVoteCountSuffix(value) {
      if (!window.TMDB || typeof window.TMDB.formatVoteCount !== "function") {
        return "";
      }

      const formatted = window.TMDB.formatVoteCount(value);
      return formatted ? ` (${formatted})` : "";
    }

    function getReleaseRecencyScore(releaseDate) {
      const year = Number(String(releaseDate || "").slice(0, 4));
      if (!Number.isFinite(year)) return 0;

      const currentYear = new Date().getFullYear();
      const delta = Math.max(0, currentYear - year);
      return Math.max(0, 1.1 - delta * 0.08);
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

    function safeMediaUrl(value) {
      const candidate = String(value || "").trim();
      if (!candidate) return fallbackPoster;

      if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
        return candidate;
      }

      try {
        const parsedUrl = new URL(candidate, window.location.origin);
        if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
          return parsedUrl.href;
        }
      } catch (error) {
        return fallbackPoster;
      }

      return fallbackPoster;
    }

