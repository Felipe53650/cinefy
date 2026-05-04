if (!window.CinefyListaPageLoaded) {
      const store = window.CinefyStore;
      const currentProfile = store.loadProfile();
      const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
      const DEFAULT_POSTER = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
      const state = store.loadListState();
      let lastPublishedSignature = "";

      const movieGrid = document.getElementById("movieGrid");
      const emptyState = document.getElementById("emptyState");
      const movieForm = document.getElementById("movieForm");
      const listSettingsForm = document.getElementById("listSettingsForm");
      const shareLinkInput = document.getElementById("shareLinkInput");
      const shareFeedback = document.getElementById("shareFeedback");
      const settingsFeedback = document.getElementById("settingsFeedback");

      document.getElementById("copyShareButton").addEventListener("click", copyShareLink);
      document.getElementById("resetListButton").addEventListener("click", resetList);
      movieForm.addEventListener("submit", handleAddMovie);
      listSettingsForm.addEventListener("submit", handleSaveSettings);

      hydrateForms();
      render();

      function saveState() {
        store.saveListState(state);
      }

      function hydrateForms() {
        document.getElementById("listTitleInput").value = state.title;
        document.getElementById("listDescriptionInput").value = state.description;
        document.getElementById("listPrivacyInput").value = state.privacy;
      }

      function render() {
        renderHeader();
        renderMovies();
        renderShareLink();
        saveState();
        void syncSharedList();
      }

      function renderHeader() {
        document.getElementById("listTitleHeading").textContent = state.title;
        document.getElementById("listDescriptionHeading").textContent = state.description;
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
              <a href="${getMovieDetailsHref(movie)}">
                <img alt="${movie.title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" decoding="async" loading="lazy" src="${escapeAttribute(movie.poster || DEFAULT_POSTER)}" />
              </a>
              <div class="movie-overlay absolute inset-0"></div>
              <div class="absolute top-3 right-3 flex items-center gap-1 bg-black/60 rounded-full px-3 py-1 border border-white/10">
                <span class="material-symbols-outlined text-yellow-400 text-sm">star</span>
                <span class="text-white text-xs font-bold">${Number(movie.rating).toFixed(1)}</span>
              </div>
              <button class="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 transition-all active:scale-95" data-action="remove" data-id="${movie.id}" type="button">
                <span class="material-symbols-outlined text-sm">delete</span>
                <span>Remover</span>
              </button>
            </div>
            <div class="p-5 flex flex-col gap-3 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <a class="text-lg font-black text-white leading-tight hover:text-red-300 transition-colors" href="${getMovieDetailsHref(movie)}">${movie.title}</a>
                  <p class="text-sm text-zinc-400">${movie.genre} • ${movie.year}</p>
                </div>
              </div>
              <p class="text-sm text-zinc-300 leading-relaxed flex-1">${movie.note || "Sem comentario adicionado."}</p>
            </div>
          </article>
        `).join("");

        movieGrid.querySelectorAll('[data-action="remove"]').forEach((button) => {
          button.addEventListener("click", () => removeMovie(button.dataset.id));
        });
      }

      function handleAddMovie(event) {
        event.preventDefault();

        const movie = {
          id: `movie-${Date.now()}`,
          title: document.getElementById("movieTitle").value.trim(),
          genre: document.getElementById("movieGenre").value.trim(),
          year: Number(document.getElementById("movieYear").value),
          rating: Number(document.getElementById("movieRating").value),
          note: document.getElementById("movieNote").value.trim(),
          poster: document.getElementById("moviePoster").value.trim() || DEFAULT_POSTER
        };

        state.movies.unshift(movie);
        touchState();
        movieForm.reset();
        render();
        shareFeedback.textContent = `${movie.title} foi adicionado a sua lista.`;
      }

      function handleSaveSettings(event) {
        event.preventDefault();
        state.title = document.getElementById("listTitleInput").value.trim();
        state.description = document.getElementById("listDescriptionInput").value.trim();
        state.privacy = document.getElementById("listPrivacyInput").value;
        touchState();
        render();
        settingsFeedback.textContent = "Informacoes da lista atualizadas.";
      }

      function removeMovie(id) {
        const movie = state.movies.find((item) => item.id === id);
        state.movies = state.movies.filter((item) => item.id !== id);
        touchState();
        render();
        shareFeedback.textContent = movie ? `${movie.title} foi removido da lista.` : "Filme removido da lista.";
      }

      function resetList() {
        const preservedShareId = state.shareId || "";
        const preservedSharedCreatedAt = state.sharedCreatedAt || "";
        const freshState = store.resetListState();
        Object.assign(state, freshState);
        if (preservedShareId) {
          state.shareId = preservedShareId;
        }
        if (preservedSharedCreatedAt) {
          state.sharedCreatedAt = preservedSharedCreatedAt;
        }
        hydrateForms();
        render();
        shareFeedback.textContent = "Lista restaurada com o exemplo inicial.";
      }

      function touchState() {
        state.updatedAt = new Date().toISOString();
      }

      function renderShareLink() {
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
        shareLinkInput.value = buildShareUrl();
      }

      async function copyShareLink() {
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
          accumulator[movie.genre] = (accumulator[movie.genre] || 0) + 1;
          return accumulator;
        }, {});

        const [genre] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0] || ["Sem genero"];
        return genre;
      }

      function formatDate(isoString) {
        return new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short"
        }).format(new Date(isoString));
      }

      function slugify(value) {
        return value
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
        const shareUrl = new URL("modoleitor.html", window.location.href);
        const params = new URLSearchParams({
          share: getShareId(),
          lista: getShareSlug()
        });
        shareUrl.search = params.toString();
        shareUrl.hash = "";
        return shareUrl.toString();
      }

      function buildSharedListPayload() {
        if (!currentProfile.uid) return null;

        if (!state.sharedCreatedAt) {
          state.sharedCreatedAt = state.updatedAt || new Date().toISOString();
        }

        return {
          shareId: getShareId(),
          slug: getShareSlug(),
          ownerUid: currentProfile.uid,
          ownerUsername: currentProfile.username || "cinefyuser",
          ownerDisplayName: currentProfile.displayName || "Cinefilo",
          ownerAvatar: currentProfile.avatar || "",
          title: state.title,
          description: state.description,
          privacy: state.privacy,
          updatedAt: state.updatedAt || new Date().toISOString(),
          createdAt: state.sharedCreatedAt,
          movies: state.movies.map((movie) => ({
            ...movie,
            poster: movie.poster || DEFAULT_POSTER
          }))
        };
      }

      async function syncSharedList() {
        if (!firestore || !currentProfile.uid) {
          lastPublishedSignature = "";
          return;
        }

        if (state.privacy !== "publica") {
          if (state.shareId) {
            try {
              await firestore.collection("shared_lists").doc(state.shareId).delete();
            } catch (error) {
              console.error("Erro ao remover lista compartilhada privada:", error);
            }
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
          .replace(/"/g, "&quot;");
      }
      }

