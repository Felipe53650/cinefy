const store = window.CinefyStore;
    const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    const profile = store.loadProfile();
    const localListState = store.loadListState();
    const defaultPoster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
    let currentShareId = shareId || "";
    let activeOwner = {
      username: profile.username || "cinefyuser",
      displayName: profile.displayName || "Cinefilo",
      avatar: profile.avatar || "/assets/img/logo.png"
    };
    let activeListState = localListState;

    bootstrapReaderMode();

    async function bootstrapReaderMode() {
      if (shareId) {
        if (!firestore) {
          renderUnavailableState("O servico de compartilhamento nao esta disponivel agora.");
          return;
        }

        await loadSharedList();
        return;
      }

      renderReaderMode();
    }

    async function loadSharedList() {
      try {
        const snapshot = await firestore.collection("shared_lists").doc(shareId).get();
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
          username: data.ownerUsername || "cinefyuser",
          displayName: data.ownerDisplayName || "Cinefilo",
          avatar: data.ownerAvatar || "/assets/img/logo.png"
        };
        activeListState = {
          title: data.title || "Lista compartilhada",
          description: data.description || "Uma curadoria compartilhada em modo somente leitura.",
          movies: Array.isArray(data.movies) ? data.movies : []
        };
        renderReaderMode();
      } catch (error) {
        console.error("Erro ao carregar lista compartilhada:", error);
        renderUnavailableState("Nao foi possivel carregar essa lista compartilhada agora.");
      }
    }

    function renderReaderMode() {
      document.title = `CINEfy - Lista de @${activeOwner.username}`;
      document.getElementById("readerTitle").textContent = shareId
        ? `Voce esta visualizando a lista compartilhada de @${activeOwner.username}`
        : `Voce esta visualizando a lista de @${activeOwner.username}`;
      document.getElementById("readerDescription").textContent = activeListState.description || "Uma curadoria compartilhada em modo somente leitura.";
      document.getElementById("readerMovieCount").textContent = activeListState.movies.length;
      document.getElementById("readerMovieCountInline").textContent = activeListState.movies.length;
      document.getElementById("readerOwnerName").textContent = activeOwner.displayName || "Cinefilo";
      document.getElementById("readerOwnerHandle").textContent = `@${activeOwner.username || "cinefyuser"}`;
      document.getElementById("readerOwnerAvatar").src = safeAvatarUrl(activeOwner.avatar);

      const grid = document.getElementById("readerGrid");
      if (!activeListState.movies.length) {
        grid.innerHTML = `
          <div class="reader-empty-state">
            <span class="material-symbols-outlined text-5xl text-red-400">local_movies</span>
            <p class="text-xl font-black text-white">Nenhum filme compartilhado ainda.</p>
            <p class="mt-2 text-zinc-400">Assim que houver filmes publicados nessa lista, eles aparecerao aqui automaticamente.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = activeListState.movies.map((movie) => `
        <article class="reader-card group glass-card rounded-3xl transition-all duration-300 hover:-translate-y-1">
          <div class="reader-card__poster">
            <a class="reader-card__poster-link" href="${escapeAttribute(getMovieDetailsHref(movie))}">
              <img alt="${escapeHtml(movie.title)}" decoding="async" loading="lazy" src="${escapeAttribute(safePosterUrl(movie.poster || defaultPoster))}"/>
            </a>
            <div class="reader-card__overlay"></div>
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
          </div>
        </article>
      `).join("");
    }

    function renderUnavailableState(message) {
      document.title = "CINEfy - Lista compartilhada indisponivel";
      document.getElementById("readerTitle").textContent = "Lista compartilhada indisponivel";
      document.getElementById("readerDescription").textContent = message;
      document.getElementById("readerMovieCount").textContent = "0";
      document.getElementById("readerMovieCountInline").textContent = "0";
      document.getElementById("readerOwnerName").textContent = "CINEfy";
      document.getElementById("readerOwnerHandle").textContent = "@cinefy";
      document.getElementById("readerOwnerAvatar").src = "/assets/img/logo.png";
      document.getElementById("readerGrid").innerHTML = `
        <div class="reader-empty-state">
          <span class="material-symbols-outlined text-5xl text-red-400">error</span>
          <p class="text-xl font-black text-white">Nao foi possivel abrir essa lista.</p>
          <p class="mt-2 text-zinc-400">${escapeHtml(message)}</p>
        </div>
      `;
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

