const store = window.CinefyStore;
const firestore = window.CinefyFirebase ? window.CinefyFirebase.firestore : null;
const currentProfile = store ? store.loadProfile() : {};
const fallbackPoster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80";
const params = new URLSearchParams(window.location.search);
const movieId = params.get("id");
const localMovieId = params.get("local");
const shareId = params.get("share");

let currentMovie = null;
let currentExternalLinks = buildExternalLinks({});
let currentTmdbReviews = [];

const addToListButton = document.getElementById("addToListButton");
const addToListButtonIcon = document.getElementById("addToListButtonIcon");
const addToListButtonLabel = document.getElementById("addToListButtonLabel");
const watchProvidersLink = document.getElementById("watchProvidersLink");
const communityReviewsLink = document.getElementById("communityReviewsLink");

document.getElementById("saveReviewButton").addEventListener("click", saveReview);
addToListButton.addEventListener("click", toggleCurrentMovieInList);

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
    const [movie, credits, releaseDates, watchProviders, externalIds, reviews] = await Promise.all([
      window.TMDB.getMovieDetails(movieId),
      window.TMDB.getMovieCredits(movieId),
      window.TMDB.getMovieReleaseDates(movieId),
      window.TMDB.getMovieWatchProviders(movieId),
      window.TMDB.getMovieExternalIds(movieId),
      window.TMDB.getMovieReviews(movieId)
    ]);

    currentMovie = movie;
    renderMovie(movie, credits, releaseDates, watchProviders, externalIds, reviews);
    hydrateReview();
    syncAddButtonState();
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
  syncAddButtonState();
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

function renderMovie(movie, credits, releaseDates, watchProviders, externalIds, reviewsResponse) {
  const certification = getMovieCertification(releaseDates);
  const providerData = getPreferredWatchProviders(watchProviders);
  const cast = Array.isArray(credits && credits.cast) ? credits.cast : [];
  const crew = Array.isArray(credits && credits.crew) ? credits.crew : [];
  const directors = getMovieDirectors(crew);
  const externalLinks = buildExternalLinks(movie, externalIds);

  currentExternalLinks = externalLinks;
  currentTmdbReviews = Array.isArray(reviewsResponse && reviewsResponse.results) ? reviewsResponse.results : [];

  document.title = `CINEfy - ${movie.title}`;
  document.getElementById("movieBackdrop").src = window.TMDB.getBackdropUrl(movie.backdrop_path, fallbackPoster);
  document.getElementById("movieTitle").textContent = movie.title;
  document.getElementById("movieOverview").textContent = movie.overview || "Sem sinopse disponivel.";
  document.getElementById("movieYear").textContent = movie.release_date ? movie.release_date.slice(0, 4) : "-";
  document.getElementById("movieRuntime").textContent = movie.runtime ? `${movie.runtime} min` : "-";
  document.getElementById("movieGenres").textContent = movie.genres && movie.genres.length ? movie.genres.map((genre) => genre.name).join(", ") : "-";
  document.getElementById("movieScore").textContent = typeof movie.vote_average === "number" ? movie.vote_average.toFixed(1) : "-";
  document.getElementById("movieCertification").textContent = certification || "Nao informado";
  document.getElementById("movieProvidersSummary").textContent = getProvidersSummary(providerData);
  document.getElementById("movieDirectors").textContent = directors.length ? directors.join(", ") : "Nao informado";
  document.getElementById("movieBadges").innerHTML = `
    ${(movie.genres || []).slice(0, 3).map((genre) => `<span class="rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-300">${escapeHtml(genre.name)}</span>`).join("")}
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${movie.release_date ? movie.release_date.slice(0, 4) : "Sem ano"}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${movie.runtime ? `${movie.runtime} min` : "Duracao nao informada"}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${escapeHtml(certification || "Classificacao nao informada")}</span>
  `;

  renderWatchProviders(providerData);
  renderExternalLinks(externalLinks);
  renderCommunityReviews(currentTmdbReviews, externalLinks);
  loadCinefyCommunityReviews();

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
  const externalLinks = buildExternalLinks(movie);
  currentExternalLinks = externalLinks;
  currentTmdbReviews = [];

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
  document.getElementById("movieCertification").textContent = "Personalizado";
  document.getElementById("movieProvidersSummary").textContent = "Indisponivel";
  document.getElementById("movieDirectors").textContent = "Nao informado";
  document.getElementById("movieBadges").innerHTML = `
    <span class="rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-300">${escapeHtml(movie.genre || "Personalizado")}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${escapeHtml(String(movie.year || "Sem ano"))}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">Filme manual</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">Classificacao personalizada</span>
  `;

  renderWatchProviders(null, true);
  renderExternalLinks(externalLinks);
  renderCommunityReviews([], externalLinks, true, []);

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
  if (!review) {
    return;
  }

  document.getElementById("ratingInput").value = review.rating || "";
  document.getElementById("commentInput").value = review.comment || "";
  document.getElementById("reviewFeedback").textContent = "Avaliacao restaurada do seu navegador.";
}

async function saveReview() {
  const reviews = loadReviews();
  const reviewPayload = {
    rating: document.getElementById("ratingInput").value,
    comment: document.getElementById("commentInput").value.trim(),
    updatedAt: new Date().toISOString()
  };

  reviews[getReviewStorageKey()] = reviewPayload;
  saveReviews(reviews);

  try {
    await syncPublicReviewForCurrentMovie(reviewPayload);
    document.getElementById("reviewFeedback").textContent = "Avaliacao salva com sucesso.";
  } catch (error) {
    console.error("Erro ao publicar review da comunidade:", error);
    document.getElementById("reviewFeedback").textContent = "Avaliacao salva no seu navegador, mas nao foi possivel atualizar a comunidade agora.";
  }

  await loadCinefyCommunityReviews();
}

function toggleCurrentMovieInList() {
  if (!currentMovie) return;
  const state = store.loadListState();
  const existingEntry = getCurrentListEntry(state);

  if (existingEntry) {
    state.movies = state.movies.filter((movie) => movie.id !== existingEntry.id);
    state.updatedAt = new Date().toISOString();
    store.saveListState(state);
    syncAddButtonState();
    document.getElementById("reviewFeedback").textContent = `${currentMovie.title} foi removido da sua lista.`;
    return;
  }

  if (localMovieId) {
    const sharedSourceId = shareId ? `${shareId}:${localMovieId}` : "";

    if (!shareId) {
      document.getElementById("reviewFeedback").textContent = "Esse filme manual ja faz parte da sua lista atual.";
      syncAddButtonState();
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
    syncAddButtonState();
    document.getElementById("reviewFeedback").textContent = `${currentMovie.title} foi adicionado a sua lista.`;
    return;
  }

  const id = `tmdb-${currentMovie.id}`;

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
  syncAddButtonState();
  document.getElementById("reviewFeedback").textContent = `${currentMovie.title} foi adicionado a sua lista.`;
}

function getCurrentListEntry(state = store.loadListState()) {
  if (!currentMovie || !state || !Array.isArray(state.movies)) {
    return null;
  }

  if (localMovieId) {
    if (shareId) {
      const sharedSourceId = `${shareId}:${localMovieId}`;
      return state.movies.find((movie) => movie.sharedSourceId === sharedSourceId) || null;
    }

    return state.movies.find((movie) => String(movie.id) === String(localMovieId)) || null;
  }

  return state.movies.find((movie) => movie.id === `tmdb-${currentMovie.id}` || String(movie.tmdbId) === String(currentMovie.id)) || null;
}

function syncAddButtonState() {
  const isAdded = Boolean(getCurrentListEntry());
  if (isAdded) {
    addToListButton.classList.add("is-added");
    addToListButtonIcon.textContent = "check";
    addToListButtonLabel.textContent = "Adicionado";
    addToListButton.setAttribute("aria-pressed", "true");
  } else {
    addToListButton.classList.remove("is-added");
    addToListButtonIcon.textContent = "add";
    addToListButtonLabel.textContent = "Adicionar a Minha Lista";
    addToListButton.setAttribute("aria-pressed", "false");
  }
}

function renderWatchProviders(providerData, isManual = false) {
  const grid = document.getElementById("watchProvidersGrid");
  const caption = document.getElementById("watchProvidersCaption");

  if (isManual || !providerData || !providerData.groups.length) {
    watchProvidersLink.classList.add("hidden");
    caption.textContent = isManual
      ? "Filmes manuais nao possuem disponibilidade sincronizada com o TMDB."
      : "O TMDB nao informou plataformas para este filme na regiao consultada.";
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        ${isManual
          ? "Como este item foi criado manualmente, nao existe uma lista de plataformas para exibir aqui."
          : "Nenhuma plataforma foi encontrada no TMDB para streaming, aluguel ou compra deste titulo no momento."}
      </div>
    `;
    return;
  }

  watchProvidersLink.classList.remove("hidden");
  watchProvidersLink.href = providerData.link || "#";
  caption.textContent = `Disponibilidade consultada para ${providerData.regionLabel}.`;
  grid.innerHTML = providerData.groups.map((group) => `
    <section class="rounded-3xl border border-white/8 bg-black/20 p-4">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">${escapeHtml(group.label)}</h4>
        <span class="text-xs text-zinc-500">${group.providers.length} opcao(oes)</span>
      </div>
      <div class="mt-4 flex flex-wrap gap-3">
        ${group.providers.map((provider) => `
          <article class="flex min-w-[9.5rem] flex-1 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
            <img alt="${escapeHtml(provider.provider_name)}" class="h-12 w-12 rounded-2xl object-cover" decoding="async" loading="lazy" src="${window.TMDB.getImageUrl(provider.logo_path, fallbackPoster)}"/>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">${escapeHtml(provider.provider_name)}</p>
              <p class="text-xs text-zinc-400">${escapeHtml(group.label)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderExternalLinks(externalLinks) {
  const grid = document.getElementById("externalLinksGrid");
  const caption = document.getElementById("externalLinksCaption");
  const links = [externalLinks.imdb, externalLinks.letterboxd, externalLinks.adoroCinema].filter(Boolean);

  if (!links.length) {
    caption.textContent = "Nao encontramos atalhos externos confiaveis para este titulo no momento.";
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        Quando houver uma correspondencia mais clara entre este filme e as plataformas externas, os atalhos rapidos aparecem aqui.
      </div>
    `;
    return;
  }

  caption.textContent = "Esses atalhos ajudam voce a continuar a pesquisa em outras comunidades e guias de cinema.";
  grid.innerHTML = links.map((link) => `
    <a class="external-link-chip inline-flex min-w-[12rem] flex-1 items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-left transition hover:border-white/16 hover:bg-white/[0.05]" href="${escapeHtml(link.href)}" rel="noopener noreferrer" target="_blank">
      <span>
        <span class="block text-xs uppercase tracking-[0.18em] text-zinc-500">${escapeHtml(link.kicker)}</span>
        <span class="mt-1 block text-sm font-semibold text-white">${escapeHtml(link.label)}</span>
      </span>
      <span class="material-symbols-outlined text-zinc-300">open_in_new</span>
    </a>
  `).join("");
}

function renderCommunityReviews(tmdbReviewsInput, externalLinks, isManual = false, cinefyReviews = []) {
  const grid = document.getElementById("communityReviewsGrid");
  const caption = document.getElementById("communityReviewsCaption");
  const letterboxdHref = externalLinks.letterboxd ? externalLinks.letterboxd.href : "#";
  communityReviewsLink.href = letterboxdHref;
  communityReviewsLink.classList.toggle("hidden", !externalLinks.letterboxd);

  if (isManual) {
    caption.textContent = "Itens manuais nao possuem reviews sincronizadas com bases externas.";
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        Esse titulo foi criado por voce, entao ainda nao existe uma trilha de reviews publicas vinculada a ele aqui no CINEfy.
      </div>
    `;
    return;
  }

  const tmdbReviews = Array.isArray(tmdbReviewsInput)
    ? tmdbReviewsInput
    : Array.isArray(tmdbReviewsInput && tmdbReviewsInput.results)
      ? tmdbReviewsInput.results
      : [];

  if (!cinefyReviews.length && !tmdbReviews.length) {
    caption.textContent = "Ainda nao encontramos reviews da comunidade para este filme.";
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        Ainda nao ha comentarios publicos aqui. Avalie este filme para comecar a conversa no CINEfy ou use os atalhos acima para continuar a leitura em outras comunidades.
      </div>
    `;
    return;
  }

  const sections = [];

  if (cinefyReviews.length) {
    sections.push(`
      <section class="space-y-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">No CINEfy</h3>
          <span class="text-xs uppercase tracking-[0.16em] text-zinc-500">${cinefyReviews.length} review(s)</span>
        </div>
        ${cinefyReviews.map((review) => `
          <article class="community-review-card rounded-3xl border border-white/8 bg-black/20 p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <img alt="${escapeHtml(review.authorName)}" class="h-12 w-12 rounded-full object-cover" decoding="async" loading="lazy" src="${escapeHtml(review.authorAvatar || fallbackPoster)}"/>
                <div class="min-w-0">
                  <p class="truncate text-base font-semibold text-white">${escapeHtml(review.authorName)}</p>
                  <p class="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">${escapeHtml(review.sourceLabel)} • ${escapeHtml(review.ratingLabel)} • ${escapeHtml(review.updatedLabel)}</p>
                </div>
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              ${review.tags.map((tag) => `
                <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white">${escapeHtml(tag)}</span>
              `).join("")}
            </div>
            <p class="mt-4 text-sm leading-7 text-zinc-300">${escapeHtml(review.comment)}</p>
          </article>
        `).join("")}
      </section>
    `);
  }

  if (tmdbReviews.length) {
    sections.push(`
      <section class="space-y-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">TMDB</h3>
          <span class="text-xs uppercase tracking-[0.16em] text-zinc-500">${Math.min(tmdbReviews.length, 4)} review(s)</span>
        </div>
        ${tmdbReviews.slice(0, 4).map((review) => {
          const authorDetails = review.author_details || {};
          const rating = typeof authorDetails.rating === "number" ? `${authorDetails.rating.toFixed(1)}/10` : "Sem nota";
          const content = truncateReview(review.content || "");
          const avatar = normalizeAvatarUrl(authorDetails.avatar_path);

          return `
            <article class="community-review-card rounded-3xl border border-white/8 bg-black/20 p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <img alt="${escapeHtml(review.author || "Autor desconhecido")}" class="h-12 w-12 rounded-full object-cover" decoding="async" loading="lazy" src="${escapeHtml(avatar || fallbackPoster)}"/>
                  <div class="min-w-0">
                    <p class="truncate text-base font-semibold text-white">${escapeHtml(review.author || "Autor desconhecido")}</p>
                    <p class="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">TMDB • ${escapeHtml(rating)} • ${escapeHtml(formatReviewDate(review.created_at || review.updated_at))}</p>
                  </div>
                </div>
                <a class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/12" href="${escapeHtml(review.url || "#")}" rel="noopener noreferrer" target="_blank">
                  Ler review
                  <span class="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white">Review publica</span>
                ${isRecentReview(review.created_at || review.updated_at)
                  ? '<span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white">Recente</span>'
                  : ''}
              </div>
              <p class="mt-4 text-sm leading-7 text-zinc-300">${escapeHtml(content)}</p>
            </article>
          `;
        }).join("")}
      </section>
    `);
  }

  caption.textContent = cinefyReviews.length
    ? "Suas reviews e as dos seus amigos aparecem primeiro, seguidas das leituras publicas do TMDB."
    : "Exibindo reviews publicas do TMDB e abrindo espaco para a comunidade do CINEfy crescer aqui.";
  grid.innerHTML = sections.join("");
}

function getMovieCertification(releaseDates) {
  const results = Array.isArray(releaseDates && releaseDates.results) ? releaseDates.results : [];
  const preferredCountries = ["BR", "US", "PT"];
  const preferredTypes = [3, 2, 4, 1, 5, 6];

  for (const countryCode of preferredCountries) {
    const match = results.find((entry) => entry.iso_3166_1 === countryCode);
    const certification = extractCertification(match && match.release_dates, countryCode, preferredTypes);
    if (certification) return certification;
  }

  for (const entry of results) {
    const certification = extractCertification(entry.release_dates, entry.iso_3166_1, preferredTypes);
    if (certification) return certification;
  }

  return "";
}

function extractCertification(releaseDates, countryCode, preferredTypes) {
  if (!Array.isArray(releaseDates)) return "";

  const sorted = [...releaseDates].sort((left, right) => {
    const leftIndex = preferredTypes.indexOf(left.type);
    const rightIndex = preferredTypes.indexOf(right.type);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });

  const entry = sorted.find((item) => item && String(item.certification || "").trim());
  if (!entry) return "";

  const certification = String(entry.certification).trim();
  return countryCode === "BR" ? certification : `${certification} (${countryCode})`;
}

function getPreferredWatchProviders(watchProviders) {
  const results = watchProviders && watchProviders.results ? watchProviders.results : {};
  const countries = [
    { code: "BR", label: "Brasil" },
    { code: "US", label: "Estados Unidos" },
    { code: "PT", label: "Portugal" }
  ];

  let selectedRegion = countries.find((country) => results[country.code]);
  if (!selectedRegion) {
    const firstRegionCode = Object.keys(results)[0];
    if (!firstRegionCode) {
      return null;
    }
    selectedRegion = { code: firstRegionCode, label: firstRegionCode };
  }

  const regionData = results[selectedRegion.code] || {};
  const mappings = [
    { key: "flatrate", label: "Streaming" },
    { key: "free", label: "Gratis" },
    { key: "ads", label: "Com anuncios" },
    { key: "rent", label: "Alugar" },
    { key: "buy", label: "Comprar" }
  ];

  const groups = mappings
    .map((mapping) => ({
      label: mapping.label,
      providers: Array.isArray(regionData[mapping.key]) ? regionData[mapping.key] : []
    }))
    .filter((group) => group.providers.length);

  return {
    regionCode: selectedRegion.code,
    regionLabel: selectedRegion.label,
    link: regionData.link || "",
    groups
  };
}

function getProvidersSummary(providerData) {
  if (!providerData || !providerData.groups.length) {
    return "Nao informado";
  }

  const names = providerData.groups[0].providers.slice(0, 2).map((provider) => provider.provider_name);
  const suffix = providerData.groups[0].providers.length > 2 ? " e outras" : "";
  return `${names.join(", ")}${suffix}`;
}

function getMovieDirectors(crew) {
  if (!Array.isArray(crew)) {
    return [];
  }

  const seen = new Set();
  return crew
    .filter((person) => String(person.job || "").toLowerCase() === "director")
    .map((person) => person.name)
    .filter((name) => {
      if (!name || seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });
}

function buildExternalLinks(movie, externalIds = {}) {
  const title = String(movie && movie.title ? movie.title : "").trim();
  const year = movie && movie.release_date
    ? String(movie.release_date).slice(0, 4)
    : String(movie && movie.year ? movie.year : "").trim();
  const searchTerm = [title, year].filter(Boolean).join(" ");
  const links = {
    imdb: null,
    letterboxd: null,
    adoroCinema: null
  };

  if (externalIds && externalIds.imdb_id) {
    links.imdb = {
      kicker: "Base de referencia",
      label: "Ver no IMDb",
      href: `https://www.imdb.com/title/${externalIds.imdb_id}/`
    };
  }

  if (searchTerm) {
    links.letterboxd = {
      kicker: "Comunidade cinemafila",
      label: "Buscar no Letterboxd",
      href: `https://letterboxd.com/search/${encodeURIComponent(searchTerm)}/`
    };

    links.adoroCinema = {
      kicker: "Guia editorial",
      label: "Buscar no AdoroCinema",
      href: `https://www.adorocinema.com/pesquisar/?q=${encodeURIComponent(searchTerm)}`
    };
  }

  return links;
}

function normalizeAvatarUrl(avatarPath) {
  if (!avatarPath) {
    return "";
  }

  if (avatarPath.startsWith("/http")) {
    return avatarPath.slice(1);
  }

  if (avatarPath.startsWith("http")) {
    return avatarPath;
  }

  return window.TMDB.getImageUrl(avatarPath, "");
}

function truncateReview(content) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 280) {
    return normalized || "Sem comentario.";
  }

  return `${normalized.slice(0, 277).trim()}...`;
}

async function loadCinefyCommunityReviews() {
  if (!movieId) {
    return;
  }

  const ownReview = getOwnCinefyReview();
  const friendReviews = await loadFriendCinefyReviews();
  const merged = [ownReview, ...friendReviews]
    .filter(Boolean)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));

  renderCommunityReviews(currentTmdbReviews, currentExternalLinks, false, merged);
}

function getOwnCinefyReview() {
  if (!store || !currentProfile || !currentProfile.uid || !movieId) {
    return null;
  }

  const reviews = store.loadReviews();
  const review = reviews[getReviewStorageKey()];
  if (!review || (!String(review.comment || "").trim() && !String(review.rating || "").trim())) {
    return null;
  }

  return normalizeCinefyReviewRecord({
    uid: currentProfile.uid,
    authorName: currentProfile.displayName || currentProfile.username || "Voce",
    authorUsername: currentProfile.username || "",
    authorAvatar: currentProfile.avatar || fallbackPoster,
    rating: review.rating,
    comment: review.comment,
    updatedAt: review.updatedAt,
    sourceLabel: "Sua review",
    isOwn: true
  });
}

async function loadFriendCinefyReviews() {
  if (!firestore || !currentProfile || !currentProfile.uid || !movieId || !store) {
    return [];
  }

  const friends = store.loadFriends().filter((friend) => friend && friend.id);
  if (!friends.length) {
    return [];
  }

  const snapshots = await Promise.all(
    friends.slice(0, 12).map((friend) =>
      firestore.collection("users").doc(friend.id).collection("public_reviews").doc(`tmdb-${movieId}`).get()
        .then((snapshot) => ({ friend, snapshot }))
        .catch((error) => {
          console.error("Erro ao carregar review de amigo:", error);
          return { friend, snapshot: null };
        })
    )
  );

  return snapshots
    .filter(({ snapshot }) => snapshot && snapshot.exists)
    .map(({ friend, snapshot }) => {
      const data = snapshot.data() || {};
      return normalizeCinefyReviewRecord({
        ...data,
        authorName: data.authorName || friend.displayName || friend.name || "Amigo",
        authorUsername: data.authorUsername || friend.username || "",
        authorAvatar: data.authorAvatar || friend.avatar || fallbackPoster,
        sourceLabel: "Amigo no CINEfy",
        isOwn: false
      });
    })
    .filter(Boolean);
}

async function syncPublicReviewForCurrentMovie(reviewPayload) {
  if (!firestore || !currentProfile || !currentProfile.uid || !movieId || localMovieId) {
    return;
  }

  const hasContent = String(reviewPayload.comment || "").trim() || String(reviewPayload.rating || "").trim();
  const docRef = firestore.collection("users").doc(currentProfile.uid).collection("public_reviews").doc(`tmdb-${movieId}`);

  if (!hasContent) {
    await docRef.delete().catch(() => {});
    return;
  }

  await docRef.set({
    movieKey: `tmdb-${movieId}`,
    tmdbId: String(movieId),
    title: currentMovie && currentMovie.title ? currentMovie.title : "",
    poster: currentMovie && currentMovie.poster_path ? window.TMDB.getImageUrl(currentMovie.poster_path, fallbackPoster) : "",
    authorUid: currentProfile.uid,
    authorName: currentProfile.displayName || currentProfile.username || "Cinefilo",
    authorUsername: currentProfile.username || "",
    authorAvatar: currentProfile.avatar || fallbackPoster,
    rating: reviewPayload.rating || "",
    comment: String(reviewPayload.comment || "").trim(),
    updatedAt: reviewPayload.updatedAt || new Date().toISOString()
  }, { merge: true });
}

function normalizeCinefyReviewRecord(review) {
  if (!review) {
    return null;
  }

  const comment = String(review.comment || "").trim();
  const rating = String(review.rating || "").trim();
  if (!comment && !rating) {
    return null;
  }

  const ratingNumber = Number(rating);
  return {
    authorName: review.authorName || "Cinefilo",
    authorUsername: review.authorUsername || "",
    authorAvatar: review.authorAvatar || fallbackPoster,
    comment: comment || "Sem comentario.",
    updatedAt: review.updatedAt || "",
    sourceLabel: review.sourceLabel || "Review no CINEfy",
    isOwn: Boolean(review.isOwn),
    ratingLabel: Number.isFinite(ratingNumber) ? `${ratingNumber.toFixed(1)}/5` : "Sem nota",
    updatedLabel: formatReviewDate(review.updatedAt),
    tags: buildReviewTags(review)
  };
}

function buildReviewTags(review) {
  const tags = [];

  if (review.isOwn) {
    tags.push("Sua review");
  } else if (review.sourceLabel === "Amigo no CINEfy") {
    tags.push("Amigo");
  } else {
    tags.push("Comunidade");
  }

  if (isRecentReview(review.updatedAt)) {
    tags.push("Recente");
  }

  return tags;
}

function isRecentReview(dateValue) {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const daysDiff = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  return daysDiff <= 14;
}

function formatReviewDate(dateValue) {
  const timestamp = new Date(dateValue);
  if (Number.isNaN(timestamp.getTime())) {
    return "Sem data";
  }

  return timestamp.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
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
