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
      displayName: profile.displayName || "Cinefilo"
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
          displayName: data.ownerDisplayName || "Cinefilo"
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

      const grid = document.getElementById("readerGrid");
      if (!activeListState.movies.length) {
        grid.innerHTML = `
          <div class="col-span-full rounded-[1.75rem] border border-dashed border-zinc-700 bg-zinc-950/60 p-10 text-center">
            <p class="text-xl font-black text-white">Nenhum filme compartilhado ainda.</p>
            <p class="mt-2 text-zinc-400">Assim que houver filmes publicados nessa lista, eles aparecerao aqui automaticamente.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = activeListState.movies.map((movie) => `
        <article class="group relative flex flex-col gap-3 rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-2">
          <a class="relative aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-zinc-800 block" href="${escapeAttribute(getMovieDetailsHref(movie))}">
            <img alt="${escapeHtml(movie.title)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" decoding="async" loading="lazy" src="${escapeAttribute(safePosterUrl(movie.poster || defaultPoster))}"/>
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
              <span class="w-full bg-white text-black font-bold py-2 rounded-lg text-sm text-center">Ver detalhes</span>
            </div>
            <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/10 flex items-center gap-1">
              <span class="material-symbols-outlined fill-icon text-yellow-500 text-xs">star</span>
              <span class="text-white text-xs font-bold">${formatRating(movie.rating)}</span>
            </div>
          </a>
          <div class="px-1">
            <a class="font-bold text-white text-sm line-clamp-1 hover:text-red-300 transition-colors" href="${escapeAttribute(getMovieDetailsHref(movie))}">${escapeHtml(movie.title)}</a>
            <p class="text-zinc-500 text-xs mt-1">${escapeHtml(movie.genre || "Filme")} • ${escapeHtml(String(movie.year || "Sem ano"))}</p>
            <p class="text-zinc-400 text-xs mt-2 line-clamp-2">${escapeHtml(movie.note || "Sem comentario adicional.")}</p>
          </div>
        </article>
      `).join("");
    }

    function renderUnavailableState(message) {
      document.title = "CINEfy - Lista compartilhada indisponivel";
      document.getElementById("readerTitle").textContent = "Lista compartilhada indisponivel";
      document.getElementById("readerDescription").textContent = message;
      document.getElementById("readerMovieCount").textContent = "0";
      document.getElementById("readerGrid").innerHTML = `
        <div class="col-span-full rounded-[1.75rem] border border-dashed border-zinc-700 bg-zinc-950/60 p-10 text-center">
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

      if (candidate.startsWith("data:image/") || candidate.startsWith("blob:")) {
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

