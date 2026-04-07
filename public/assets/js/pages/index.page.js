const store = window.CinefyStore;
    const fallbackPoster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
    let heroMovie = null;

    document.getElementById("heroListButton").addEventListener("click", () => {
      if (!heroMovie) return;
      addMovieToList(heroMovie);
    });

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
        }

        store.syncCatalogNotifications(featured.slice(0, 10));
        renderMovieScroller("featuredScroller", featured.slice(0, 12));
        renderMovieScroller("topRatedScroller", topRated.slice(0, 12));
        renderMyListScroller(myList);
      } catch (error) {
        console.error("Erro ao carregar a home do TMDB:", error);
        document.getElementById("heroTitle").textContent = "Nao foi possivel carregar o TMDB";
        document.getElementById("heroOverview").textContent = "Verifique sua conexao ou a chave da API para exibir o catalogo real.";
      }
    }

    function renderHero(movie) {
      document.getElementById("heroBackdrop").src = window.TMDB.getBackdropUrl(movie.backdrop_path, fallbackPoster);
      document.getElementById("heroTitle").textContent = movie.title;
      document.getElementById("heroOverview").textContent = movie.overview || "Sem sinopse disponivel.";
      document.getElementById("heroMetaPrimary").textContent = `${formatYear(movie.release_date)} • Nota ${formatRating(movie.vote_average)}`;
      document.getElementById("heroMetaSecondary").textContent = "Tendencia da semana";
      document.getElementById("heroDetailsLink").href = `detalhes.html?id=${movie.id}`;
    }

    function renderMovieScroller(containerId, movies) {
      const container = document.getElementById(containerId);
      container.innerHTML = movies.map((movie) => `
        <article class="group min-w-[160px] max-w-[160px] sm:min-w-[190px] sm:max-w-[190px] md:min-w-[250px] md:max-w-[250px]">
          <a class="block" href="detalhes.html?id=${encodeURIComponent(String(movie.id || ""))}">
            <div class="relative mb-4 aspect-[2/3] overflow-hidden rounded-[1.6rem] border border-white/10 bg-zinc-900 shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
              <img alt="${escapeHtml(movie.title)}" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" decoding="async" loading="lazy" src="${escapeAttribute(safeMediaUrl(window.TMDB.getImageUrl(movie.poster_path, fallbackPoster)))}" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-90"></div>
              <div class="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                <span class="material-symbols-outlined fill-icon text-sm text-yellow-400">star</span>
                ${formatRating(movie.vote_average)}
              </div>
              <div class="absolute bottom-3 left-3 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
                ${formatYear(movie.release_date)}
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

    function addMovieToList(movie) {
      const state = store.loadListState();
      const movieId = `tmdb-${movie.id}`;

      if (state.movies.some((item) => item.id === movieId)) {
        document.getElementById("homeFeedback").textContent = "Esse filme ja esta na sua lista.";
        return;
      }

      state.movies.unshift({
        id: movieId,
        tmdbId: movie.id,
        title: movie.title,
        genre: "TMDB",
        year: formatYear(movie.release_date),
        rating: Number(movie.vote_average || 0) / 2,
        note: movie.overview || "Adicionado pela home.",
        poster: window.TMDB.getImageUrl(movie.poster_path, fallbackPoster)
      });
      state.updatedAt = new Date().toISOString();
      store.saveListState(state);
      renderMyListScroller(state.movies);
      document.getElementById("homeFeedback").textContent = `${movie.title} foi adicionado a sua lista.`;
    }

    function formatYear(releaseDate) {
      return releaseDate ? String(releaseDate).slice(0, 4) : "Sem ano";
    }

    function formatRating(voteAverage) {
      return typeof voteAverage === "number" ? voteAverage.toFixed(1) : "N/A";
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

      if (candidate.startsWith("data:image/") || candidate.startsWith("blob:")) {
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

