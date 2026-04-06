const store = window.CinefyStore;
    const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
    const fallbackPoster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80";
    const params = new URLSearchParams(window.location.search);
    const movieId = params.get("id");
    const localMovieId = params.get("local");
    const shareId = params.get("share");
    let currentMovie = null;

    document.getElementById("saveReviewButton").addEventListener("click", saveReview);
    document.getElementById("addToListButton").addEventListener("click", addCurrentMovieToList);

    loadMovie();

    async function loadMovie() {
      if (localMovieId) {
        await loadLocalMovie();
        return;
      }

      if (!movieId) {
        document.getElementById("movieTitle").textContent = "Filme nao encontrado";
        document.getElementById("movieOverview").textContent = "Abra esta pagina a partir de um card do catalogo para ver os detalhes.";
        return;
      }

      try {
        const [movie, credits] = await Promise.all([
          window.TMDB.getMovieDetails(movieId),
          window.TMDB.getMovieCredits(movieId)
        ]);

        currentMovie = movie;
        renderMovie(movie, credits.cast || []);
        hydrateReview();
      } catch (error) {
        console.error("Erro ao carregar detalhes:", error);
        document.getElementById("movieTitle").textContent = "Nao foi possivel carregar este filme";
        document.getElementById("movieOverview").textContent = "A consulta ao TMDB falhou. Tente novamente mais tarde.";
      }
    }

    async function loadLocalMovie() {
      const localMovie = await findLocalMovie();

      if (!localMovie) {
        document.getElementById("movieTitle").textContent = "Filme nao encontrado";
        document.getElementById("movieOverview").textContent = shareId
          ? "Esse item manual nao foi encontrado na lista compartilhada."
          : "Esse item manual nao foi encontrado na sua lista atual.";
        return;
      }

      currentMovie = localMovie;
      renderLocalMovie(localMovie);
      hydrateReview();
    }

    async function findLocalMovie() {
      if (shareId && !firestore) {
        return null;
      }

      if (shareId && firestore) {
        try {
          const snapshot = await firestore.collection("shared_lists").doc(shareId).get();
          if (snapshot.exists) {
            const sharedList = snapshot.data() || {};
            const sharedMovies = Array.isArray(sharedList.movies) ? sharedList.movies : [];
            const sharedMovie = sharedMovies.find((movie) => String(movie.id) === localMovieId);
            if (sharedMovie) {
              return sharedMovie;
            }
          }
        } catch (error) {
          console.error("Erro ao carregar filme manual compartilhado:", error);
        }
      }

      return store.loadListState().movies.find((movie) => String(movie.id) === localMovieId);
    }

    function renderMovie(movie, cast) {
      document.title = `CINEfy - ${movie.title}`;
      document.getElementById("movieBackdrop").src = window.TMDB.getBackdropUrl(movie.backdrop_path, fallbackPoster);
      document.getElementById("movieTitle").textContent = movie.title;
      document.getElementById("movieOverview").textContent = movie.overview || "Sem sinopse disponivel.";
      document.getElementById("movieYear").textContent = movie.release_date ? movie.release_date.slice(0, 4) : "-";
      document.getElementById("movieRuntime").textContent = movie.runtime ? `${movie.runtime} min` : "-";
      document.getElementById("movieGenres").textContent = movie.genres && movie.genres.length ? movie.genres.map((genre) => genre.name).join(", ") : "-";
      document.getElementById("movieScore").textContent = typeof movie.vote_average === "number" ? movie.vote_average.toFixed(1) : "-";
      document.getElementById("movieBadges").innerHTML = `
        ${(movie.genres || []).slice(0, 3).map((genre) => `<span class="rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-300">${escapeHtml(genre.name)}</span>`).join("")}
        <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${movie.release_date ? movie.release_date.slice(0, 4) : "Sem ano"}</span>
        <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${movie.runtime ? `${movie.runtime} min` : "Duracao nao informada"}</span>
      `;
      document.getElementById("castGrid").innerHTML = cast.slice(0, 6).map((person) => `
        <article class="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <img alt="${escapeHtml(person.name)}" class="mb-3 h-16 w-16 rounded-2xl object-cover" decoding="async" loading="lazy" src="${person.profile_path ? window.TMDB.getImageUrl(person.profile_path, fallbackPoster) : fallbackPoster}" />
          <p class="text-sm font-bold text-white">${escapeHtml(person.name)}</p>
          <p class="mt-1 text-xs text-zinc-400">${escapeHtml(person.character || "Elenco")}</p>
        </article>
      `).join("") || `
        <div class="col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-400">
          O TMDB nao retornou elenco principal para este filme.
        </div>
      `;
    }

    function renderLocalMovie(movie) {
      document.title = `CINEfy - ${movie.title}`;
      document.getElementById("movieBackdrop").src = movie.poster || fallbackPoster;
      document.getElementById("movieTitle").textContent = movie.title;
      document.getElementById("movieOverview").textContent = movie.note || (shareId
        ? "Filme adicionado manualmente a uma lista compartilhada."
        : "Filme adicionado manualmente a sua lista.");
      document.getElementById("movieYear").textContent = movie.year || "-";
      document.getElementById("movieRuntime").textContent = "Nao informado";
      document.getElementById("movieGenres").textContent = movie.genre || "-";
      document.getElementById("movieScore").textContent = typeof movie.rating === "number" ? movie.rating.toFixed(1) : "-";
      document.getElementById("movieBadges").innerHTML = `
        <span class="rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-300">${escapeHtml(movie.genre || "Personalizado")}</span>
        <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${escapeHtml(String(movie.year || "Sem ano"))}</span>
        <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">Filme manual</span>
      `;
      document.getElementById("castGrid").innerHTML = `
        <div class="col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-400">
          Esse filme foi adicionado manualmente, entao nao ha elenco do TMDB disponivel para exibir aqui.
        </div>
      `;
    }

    function loadReviews() {
      return store.loadReviews();
    }

    function saveReviews(reviews) {
      store.saveReviews(reviews);
    }

    function hydrateReview() {
      const reviews = loadReviews();
      const review = reviews[getReviewStorageKey()];
      if (!review) return;

      document.getElementById("ratingInput").value = review.rating || "";
      document.getElementById("commentInput").value = review.comment || "";
      document.getElementById("reviewFeedback").textContent = "Avaliacao restaurada do seu navegador.";
    }

    function saveReview() {
      const reviews = loadReviews();
      reviews[getReviewStorageKey()] = {
        rating: document.getElementById("ratingInput").value,
        comment: document.getElementById("commentInput").value.trim(),
        updatedAt: new Date().toISOString()
      };
      saveReviews(reviews);
      document.getElementById("reviewFeedback").textContent = "Avaliacao salva com sucesso.";
    }

    function addCurrentMovieToList() {
      if (!currentMovie) return;

      if (localMovieId) {
        const state = store.loadListState();
        const sharedSourceId = shareId ? `${shareId}:${localMovieId}` : "";

        if (!shareId) {
          document.getElementById("reviewFeedback").textContent = "Esse filme ja faz parte da sua lista atual.";
          return;
        }

        if (state.movies.some((movie) => movie.sharedSourceId === sharedSourceId)) {
          document.getElementById("reviewFeedback").textContent = "Esse filme compartilhado ja foi adicionado a sua lista.";
          return;
        }

        state.movies.unshift({
          id: `shared-${Date.now()}`,
          sharedSourceId,
          title: currentMovie.title,
          genre: currentMovie.genre || "Personalizado",
          year: currentMovie.year || "",
          rating: Number(currentMovie.rating || 0),
          note: currentMovie.note || "Adicionado de uma lista compartilhada.",
          poster: currentMovie.poster || fallbackPoster
        });
        state.updatedAt = new Date().toISOString();
        store.saveListState(state);
        document.getElementById("reviewFeedback").textContent = `${currentMovie.title} foi adicionado a sua lista.`;
        return;
      }

      const state = store.loadListState();
      const id = `tmdb-${currentMovie.id}`;

      if (state.movies.some((movie) => movie.id === id)) {
        document.getElementById("reviewFeedback").textContent = "Esse filme ja esta na sua lista.";
        return;
      }

      state.movies.unshift({
        id,
        tmdbId: currentMovie.id,
        title: currentMovie.title,
        genre: currentMovie.genres && currentMovie.genres[0] ? currentMovie.genres[0].name : "TMDB",
        year: currentMovie.release_date ? Number(currentMovie.release_date.slice(0, 4)) : "",
        rating: Number(currentMovie.vote_average || 0) / 2,
        note: currentMovie.overview || "Adicionado pela tela de detalhes.",
        poster: window.TMDB.getImageUrl(currentMovie.poster_path, fallbackPoster)
      });
      state.updatedAt = new Date().toISOString();
      store.saveListState(state);
      document.getElementById("reviewFeedback").textContent = `${currentMovie.title} foi adicionado a sua lista.`;
    }

    function getReviewStorageKey() {
      return localMovieId
        ? `local-${shareId ? `${shareId}-` : ""}${localMovieId}`
        : `tmdb-${movieId}`;
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

