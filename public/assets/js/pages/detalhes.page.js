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
let currentCinefyReviews = [];
let currentWatchProvidersPayload = null;
const relationshipState = {
  friends: new Set(),
  incoming: new Set(),
  outgoing: new Set(),
  loaded: false
};

function resolveUserAvatar(userLike) {
  if (store && typeof store.resolveProfileAvatar === "function") {
    return store.resolveProfileAvatar(userLike || { username: "cinefyuser" });
  }

  return (userLike && userLike.avatar) || "/assets/img/logo.svg";
}

const addToListButton = document.getElementById("addToListButton");
const addToListButtonIcon = document.getElementById("addToListButtonIcon");
const addToListButtonLabel = document.getElementById("addToListButtonLabel");
const watchProvidersLink = document.getElementById("watchProvidersLink");
const watchProvidersRegionSelect = document.getElementById("watchProvidersRegion");
const communityReviewsLink = document.getElementById("communityReviewsLink");
const ratingInput = document.getElementById("ratingInput");
const ratingStars = document.getElementById("ratingStars");

document.getElementById("saveReviewButton").addEventListener("click", saveReview);
addToListButton.addEventListener("click", toggleCurrentMovieInList);
ratingInput.addEventListener("input", syncRatingStars);
watchProvidersRegionSelect.addEventListener("change", handleWatchProviderRegionChange);
syncRatingStars();

void loadViewerRelationshipState();
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
    const [movie, credits, releaseDates, watchProviders, externalIds, reviews, recommendations] = await Promise.all([
      window.TMDB.getMovieDetails(movieId),
      window.TMDB.getMovieCredits(movieId),
      window.TMDB.getMovieReleaseDates(movieId),
      window.TMDB.getMovieWatchProviders(movieId),
      window.TMDB.getMovieExternalIds(movieId),
      window.TMDB.getMovieReviews(movieId),
      window.TMDB.getMovieRecommendations(movieId)
    ]);

    currentMovie = movie;
    renderMovie(movie, credits, releaseDates, watchProviders, externalIds, reviews, recommendations);
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

function renderMovie(movie, credits, releaseDates, watchProviders, externalIds, reviewsResponse, recommendations = []) {
  const certification = getMovieCertification(releaseDates);
  const cast = Array.isArray(credits && credits.cast) ? credits.cast : [];
  const crew = Array.isArray(credits && credits.crew) ? credits.crew : [];
  const directors = getMovieDirectors(crew);
  const leadCast = getLeadCastNames(cast);
  const externalLinks = buildExternalLinks(movie, externalIds);

  currentExternalLinks = externalLinks;
  currentTmdbReviews = Array.isArray(reviewsResponse && reviewsResponse.results) ? reviewsResponse.results : [];
  currentWatchProvidersPayload = watchProviders && typeof watchProviders === "object" ? watchProviders : null;

  const providerData = buildWatchProviderState(currentWatchProvidersPayload, "BR");

  document.title = `Cinefy Club - ${movie.title}`;
  document.getElementById("movieBackdrop").src = window.TMDB.getBackdropUrl(movie.backdrop_path, fallbackPoster);
  document.getElementById("movieTitle").textContent = movie.title;
  document.getElementById("movieOverview").textContent = movie.overview || "Sem sinopse disponivel.";
  document.getElementById("movieQuickSummary").textContent = buildMovieQuickSummary({
    directors,
    leadCast,
    originalLanguage: movie.original_language
  });
  document.getElementById("movieYear").textContent = movie.release_date ? movie.release_date.slice(0, 4) : "-";
  document.getElementById("movieRuntime").textContent = movie.runtime ? `${movie.runtime} min` : "-";
  document.getElementById("movieGenres").textContent = movie.genres && movie.genres.length ? movie.genres.map((genre) => genre.name).join(", ") : "-";
  document.getElementById("movieScore").textContent = buildTmdbScoreLabel(movie.vote_average, movie.vote_count);
  document.getElementById("movieCertification").textContent = certification || "Nao informado";
  document.getElementById("movieProvidersSummary").textContent = getProvidersSummary(providerData);
  document.getElementById("movieDirectors").textContent = directors.length ? directors.join(", ") : "Nao informado";
  document.getElementById("movieLeadCast").textContent = leadCast.length ? leadCast.join(", ") : "Nao informado";
  document.getElementById("movieOriginalLanguage").textContent = formatLanguageLabel(movie.original_language);
  document.getElementById("movieBadges").innerHTML = `
    ${(movie.genres || []).slice(0, 3).map((genre) => `<span class="rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-300">${escapeHtml(genre.name)}</span>`).join("")}
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${movie.release_date ? movie.release_date.slice(0, 4) : "Sem ano"}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${movie.runtime ? `${movie.runtime} min` : "Duracao nao informada"}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${escapeHtml(certification || "Classificacao nao informada")}</span>
  `;

  renderHeroStats({
    score: movie.vote_average,
    voteCount: movie.vote_count,
    certification,
    runtime: movie.runtime
  });
  renderWatchProviders(providerData);
  renderExternalLinks(externalLinks);
  renderSimilarMovies(recommendations);
  renderCommunityReviews(currentTmdbReviews, externalLinks);
  loadCinefyCommunityReviews();

  document.getElementById("castGrid").innerHTML = cast.slice(0, 6).map((person) => `
    <a class="details-cast-card rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-white/18 hover:bg-white/[0.04]" href="https://www.themoviedb.org/person/${escapeHtml(String(person.id || ""))}" rel="noopener noreferrer" target="_blank">
      <img alt="${escapeHtml(person.name)}" class="mb-3 h-16 w-16 rounded-2xl object-cover" decoding="async" loading="lazy" src="${person.profile_path ? window.TMDB.getImageUrl(person.profile_path, fallbackPoster) : fallbackPoster}" />
      <p class="text-sm font-bold text-white">${escapeHtml(person.name)}</p>
      <p class="mt-1 text-xs text-zinc-400">${escapeHtml(person.character || "Elenco")}</p>
      <span class="mt-3 inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-300">
        Ver perfil
        <span class="material-symbols-outlined text-sm">open_in_new</span>
      </span>
    </a>
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
  currentWatchProvidersPayload = null;

  document.title = `Cinefy Club - ${movie.title}`;
  document.getElementById("movieBackdrop").src = movie.poster || fallbackPoster;
  document.getElementById("movieTitle").textContent = movie.title;
  document.getElementById("movieOverview").textContent = movie.note || (shareId
    ? "Filme adicionado manualmente a uma lista compartilhada."
    : "Filme adicionado manualmente a sua lista.");
  document.getElementById("movieQuickSummary").textContent = buildMovieQuickSummary({
    isManual: true,
    genre: movie.genre,
    year: movie.year
  });
  document.getElementById("movieYear").textContent = movie.year || "-";
  document.getElementById("movieRuntime").textContent = "Nao informado";
  document.getElementById("movieGenres").textContent = movie.genre || "-";
  document.getElementById("movieScore").textContent = typeof movie.rating === "number" ? movie.rating.toFixed(1) : "-";
  document.getElementById("movieCertification").textContent = "Personalizado";
  document.getElementById("movieProvidersSummary").textContent = "Indisponível";
  document.getElementById("movieDirectors").textContent = "Nao informado";
  document.getElementById("movieLeadCast").textContent = "Nao informado";
  document.getElementById("movieOriginalLanguage").textContent = "Nao informado";
  document.getElementById("movieBadges").innerHTML = `
    <span class="rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-300">${escapeHtml(movie.genre || "Personalizado")}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">${escapeHtml(String(movie.year || "Sem ano"))}</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">Filme manual</span>
    <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200">Classificacao personalizada</span>
  `;

  renderHeroStats({
    score: typeof movie.rating === "number" ? movie.rating : 0,
    voteCount: 1,
    certification: "Personalizado",
    runtime: 0,
    isManual: true
  });
  renderWatchProviders(null, true);
  renderExternalLinks(externalLinks);
  renderSimilarMovies([], true);
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
    syncRatingStars();
    return;
  }

  document.getElementById("ratingInput").value = review.rating || "";
  document.getElementById("commentInput").value = review.comment || "";
  document.getElementById("reviewFeedback").textContent = "Avaliacao restaurada do seu navegador.";
  syncRatingStars();
}

function syncRatingStars() {
  if (!ratingStars) {
    return;
  }

  const value = sanitizeReviewRating(ratingInput.value);
  ratingStars.innerHTML = Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;
    const icon = value >= starValue ? "star" : value >= starValue - 0.5 ? "star_half" : "star_outline";

    return `
      <button
        class="details-rating-star ${value >= starValue ? "is-active" : ""}"
        data-rating-value="${starValue}"
        type="button"
      >
        <span class="material-symbols-outlined filled-icon">${icon}</span>
        <span class="sr-only">Dar nota ${starValue}</span>
      </button>
    `;
  }).join("");

  ratingStars.querySelectorAll("[data-rating-value]").forEach((button) => {
    button.addEventListener("click", () => {
      ratingInput.value = button.getAttribute("data-rating-value") || "";
      syncRatingStars();
    });
  });
}

async function saveReview() {
  const reviews = loadReviews();
  const reviewPayload = {
    rating: sanitizeReviewRating(document.getElementById("ratingInput").value),
    comment: sanitizeReviewComment(document.getElementById("commentInput").value),
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

function buildTmdbScoreLabel(score, voteCount) {
  const formattedScore = typeof score === "number" ? score.toFixed(1) : "-";
  if (!window.TMDB || typeof window.TMDB.formatVoteCount !== "function") {
    return formattedScore;
  }

  const formattedVoteCount = window.TMDB.formatVoteCount(voteCount);
  return formattedVoteCount ? `${formattedScore} (${formattedVoteCount})` : formattedScore;
}

function renderWatchProviders(providerData, isManual = false) {
  const grid = document.getElementById("watchProvidersGrid");
  const caption = document.getElementById("watchProvidersCaption");

  if (isManual || !providerData || !providerData.hasAnyData) {
    watchProvidersLink.classList.add("hidden");
    watchProvidersRegionSelect.classList.add("hidden");
    caption.textContent = isManual
      ? "Filmes manuais nao possuem disponibilidade sincronizada com o TMDB."
      : "O TMDB não informou disponibilidade por região para este filme.";
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        ${isManual
          ? "Como este item foi criado manualmente, nao existe uma lista de plataformas para exibir aqui."
          : "Nenhuma plataforma foi encontrada no TMDB para streaming, aluguel ou compra deste titulo no momento."}
      </div>
    `;
    return;
  }

  renderWatchProviderRegionOptions(providerData);

  if (!providerData.groups.length) {
    watchProvidersLink.classList.add("hidden");
    caption.textContent = providerData.hasRequestedRegionData
      ? `O TMDB tem dados para ${providerData.regionLabel}, mas não listou plataformas de streaming, aluguel ou compra.`
      : `O TMDB não retornou dados para ${providerData.regionLabel}. Escolha outra região disponível.`;
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        ${providerData.hasRequestedRegionData
          ? `Não há plataformas listadas para ${escapeHtml(providerData.regionLabel)} neste momento.`
          : "A lista abaixo mostra apenas regiões que o TMDB retornou para este título."}
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
        <span class="text-xs text-zinc-500">${escapeHtml(formatProviderCount(group.providers.length))}</span>
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
  const summary = document.getElementById("communityReviewsSummary");
  const letterboxdHref = externalLinks.letterboxd ? externalLinks.letterboxd.href : "#";
  currentCinefyReviews = Array.isArray(cinefyReviews) ? cinefyReviews : [];
  communityReviewsLink.href = letterboxdHref;
  communityReviewsLink.classList.toggle("hidden", !externalLinks.letterboxd);

  if (isManual) {
    caption.textContent = "Itens manuais nao possuem reviews sincronizadas com bases externas.";
    summary.innerHTML = "";
    renderCommunitySignal([], [], true);
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        Esse titulo foi criado por voce, entao ainda nao existe uma trilha de reviews publicas vinculada a ele aqui no Cinefy Club.
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
    summary.innerHTML = "";
    renderCommunitySignal([], [], false);
    grid.innerHTML = `
      <div class="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        Ainda nao ha comentarios publicos aqui. Avalie este filme para comecar a conversa no Cinefy Club ou use os atalhos acima para continuar a leitura em outras comunidades.
      </div>
    `;
    return;
  }

  const sections = [];

  if (cinefyReviews.length) {
    sections.push(`
      <section class="space-y-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">No Cinefy Club</h3>
          <span class="text-xs uppercase tracking-[0.16em] text-zinc-500">${cinefyReviews.length} review(s)</span>
        </div>
        ${cinefyReviews.map((review) => `
          <article class="community-review-card rounded-3xl border border-white/8 bg-black/20 p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="community-review-card__author-row">
                ${review.authorHref
                ? `<a class="cinefy-user-link cinefy-user-link-card" href="${escapeHtml(review.authorHref)}">
                    <img alt="${escapeHtml(review.authorName)}" class="h-12 w-12 rounded-full object-cover" decoding="async" loading="lazy" src="${escapeHtml(review.authorAvatar || fallbackPoster)}"/>
                    <div class="min-w-0">
                      <p class="truncate text-base font-semibold text-white">${escapeHtml(review.authorName)}</p>
                      <p class="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">${escapeHtml(review.sourceLabel)} • ${escapeHtml(review.ratingLabel)} • ${escapeHtml(review.updatedLabel)}</p>
                    </div>
                  </a>`
                : `<div class="flex min-w-0 items-center gap-3">
                    <img alt="${escapeHtml(review.authorName)}" class="h-12 w-12 rounded-full object-cover" decoding="async" loading="lazy" src="${escapeHtml(review.authorAvatar || fallbackPoster)}"/>
                    <div class="min-w-0">
                      <p class="truncate text-base font-semibold text-white">${escapeHtml(review.authorName)}</p>
                      <p class="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">${escapeHtml(review.sourceLabel)} • ${escapeHtml(review.ratingLabel)} • ${escapeHtml(review.updatedLabel)}</p>
                    </div>
                  </div>`}
                ${renderReviewFriendAction(review)}
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
    : "Exibindo reviews publicas do TMDB e abrindo espaco para a comunidade do Cinefy Club crescer aqui.";
  renderCommunitySignal(cinefyReviews, tmdbReviews);
  summary.innerHTML = buildReviewSummaryCards(cinefyReviews, tmdbReviews);
  grid.innerHTML = sections.join("");

  grid.querySelectorAll("[data-review-social-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-review-social-action");
      const targetUid = button.getAttribute("data-target-uid") || "";
      const targetName = button.getAttribute("data-target-name") || "";
      const targetUsername = button.getAttribute("data-target-username") || "";
      const targetAvatar = button.getAttribute("data-target-avatar") || "";

      if (!action || !targetUid) return;
      await handleReviewSocialAction(action, {
        uid: targetUid,
        displayName: targetName,
        username: targetUsername,
        avatar: targetAvatar
      });
    });
  });
}

function renderReviewFriendAction(review) {
  if (!review || !review.showFriendAction || !review.authorUid) {
    return "";
  }

  if (review.relationshipStatus === "friend") {
    return `
      <button class="review-social-action review-social-action--state" disabled type="button">
        <span class="material-symbols-outlined text-sm">group</span>
        <span>Amigo</span>
      </button>
    `;
  }

  if (review.relationshipStatus === "outgoing") {
    return `
      <button class="review-social-action review-social-action--state" disabled type="button">
        <span class="material-symbols-outlined text-sm">schedule</span>
        <span>Pedido enviado</span>
      </button>
    `;
  }

  if (review.relationshipStatus === "incoming") {
    return `
      <button class="review-social-action review-social-action--primary" data-review-social-action="accept" data-target-avatar="${escapeHtml(review.authorAvatar || "")}" data-target-name="${escapeHtml(review.authorName || "")}" data-target-uid="${escapeHtml(review.authorUid)}" data-target-username="${escapeHtml(review.authorUsername || "")}" type="button">
        <span class="material-symbols-outlined text-sm">person_add</span>
        <span>Aceitar amizade</span>
      </button>
    `;
  }

  return `
    <button class="review-social-action review-social-action--primary" data-review-social-action="add" data-target-avatar="${escapeHtml(review.authorAvatar || "")}" data-target-name="${escapeHtml(review.authorName || "")}" data-target-uid="${escapeHtml(review.authorUid)}" data-target-username="${escapeHtml(review.authorUsername || "")}" type="button">
      <span class="material-symbols-outlined text-sm">person_add</span>
      <span>Adicionar amigo</span>
    </button>
  `;
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

function handleWatchProviderRegionChange() {
  if (!currentWatchProvidersPayload) {
    return;
  }

  const providerState = buildWatchProviderState(currentWatchProvidersPayload, watchProvidersRegionSelect.value || "BR");
  renderWatchProviders(providerState);
  document.getElementById("movieProvidersSummary").textContent = getProvidersSummary(providerState);
}

function renderWatchProviderRegionOptions(providerData) {
  if (!providerData || !Array.isArray(providerData.availableRegions) || providerData.availableRegions.length <= 1) {
    watchProvidersRegionSelect.classList.add("hidden");
    watchProvidersRegionSelect.innerHTML = "";
    return;
  }

  watchProvidersRegionSelect.classList.remove("hidden");
  watchProvidersRegionSelect.innerHTML = providerData.availableRegions.map((region) => `
    <option value="${escapeAttribute(region.code)}" ${region.code === providerData.selectedRegion.code ? "selected" : ""}>
      ${escapeHtml(region.label)}
    </option>
  `).join("");
}

function buildWatchProviderState(watchProviders, selectedRegionCode = "BR") {
  const results = watchProviders && watchProviders.results ? watchProviders.results : {};
  const availableCodes = Object.keys(results);

  if (!availableCodes.length) {
    return null;
  }

  const normalizedRegionCode = String(selectedRegionCode || "BR").toUpperCase();
  const regionCode = normalizedRegionCode || "BR";
  const regionData = results[regionCode] || null;
  const mappings = [
    { key: "flatrate", label: "Streaming" },
    { key: "free", label: "Grátis" },
    { key: "ads", label: "Com anúncios" },
    { key: "rent", label: "Alugar" },
    { key: "buy", label: "Comprar" }
  ];

  const groups = mappings
    .map((mapping) => ({
      label: mapping.label,
      providers: Array.isArray(regionData && regionData[mapping.key]) ? regionData[mapping.key] : []
    }))
    .filter((group) => group.providers.length);

  const availableRegions = availableCodes
    .sort((left, right) => getRegionLabel(left).localeCompare(getRegionLabel(right), "pt-BR"))
    .map((code) => ({
      code,
      label: getRegionLabel(code)
    }));

  return {
    hasAnyData: availableCodes.length > 0,
    hasRequestedRegionData: Boolean(regionData),
    selectedRegion: {
      code: regionCode,
      label: getRegionLabel(regionCode)
    },
    regionLabel: getRegionLabel(regionCode),
    link: regionData && regionData.link ? regionData.link : "",
    groups,
    availableRegions
  };
}

function getProvidersSummary(providerData) {
  if (!providerData) {
    return "Nao informado";
  }

  if (!providerData.groups.length) {
    return providerData.selectedRegion && providerData.selectedRegion.code === "BR"
      ? "Indisponível no Brasil"
      : "Indisponível";
  }

  const names = providerData.groups[0].providers.slice(0, 2).map((provider) => provider.provider_name);
  const suffix = providerData.groups[0].providers.length > 2 ? " e outras" : "";
  return `${names.join(", ")}${suffix}`;
}

function formatProviderCount(count) {
  const safeCount = Number(count) || 0;
  return safeCount === 1 ? "1 opção" : `${safeCount} opções`;
}

function renderHeroStats({ score, voteCount, certification, runtime, isManual = false }) {
  const heroStats = document.getElementById("movieHeroStats");
  if (!heroStats) {
    return;
  }

  const stats = isManual
    ? [
      {
        label: "Sua nota",
        value: Number.isFinite(Number(score)) && Number(score) > 0 ? Number(score).toFixed(1) : "Sem nota"
      },
      {
        label: "Tipo",
        value: "Filme manual"
      },
      {
        label: "Classificacao",
        value: certification || "Personalizada"
      }
    ]
    : [
      {
        label: "Nota TMDB",
        value: buildStarSummaryLabel(score)
      },
      {
        label: "Avaliacoes",
        value: voteCount ? `${window.TMDB.formatVoteCount(voteCount)} no TMDB` : "Sem volume informado"
      },
      {
        label: "Classificacao",
        value: certification || "Nao informada"
      },
      {
        label: "Duracao",
        value: runtime ? `${runtime} min` : "Nao informada"
      }
    ];

  heroStats.innerHTML = stats.map((stat) => `
    <div class="details-hero-stat">
      <span class="details-hero-stat__label">${escapeHtml(stat.label)}</span>
      <span class="details-hero-stat__value">${escapeHtml(stat.value)}</span>
    </div>
  `).join("");
}

function buildMovieQuickSummary({ directors = [], leadCast = [], originalLanguage = "", isManual = false, genre = "", year = "" }) {
  if (isManual) {
    const manualParts = [];
    if (genre) {
      manualParts.push(`Genero ${genre}`);
    }
    if (year) {
      manualParts.push(`ano ${year}`);
    }
    manualParts.push("titulo manual salvo na sua lista");
    return manualParts.join(" • ");
  }

  const summaryParts = [];
  if (Array.isArray(directors) && directors.length) {
    summaryParts.push(`Direcao de ${directors.slice(0, 2).join(", ")}`);
  }
  if (Array.isArray(leadCast) && leadCast.length) {
    summaryParts.push(`com ${leadCast.slice(0, 3).join(", ")}`);
  }

  const languageLabel = formatLanguageLabel(originalLanguage);
  if (languageLabel && languageLabel !== "Nao informado") {
    summaryParts.push(`idioma original ${languageLabel}`);
  }

  if (!summaryParts.length) {
    return "Estamos organizando o contexto rapido deste titulo para voce.";
  }

  return summaryParts.join(" • ");
}

function buildStarSummaryLabel(score) {
  const normalizedScore = Number(score || 0);
  if (!Number.isFinite(normalizedScore) || normalizedScore <= 0) {
    return "Sem nota";
  }

  return `★ ${normalizedScore.toFixed(1)}`;
}

function getLeadCastNames(cast) {
  if (!Array.isArray(cast)) {
    return [];
  }

  return cast
    .slice(0, 4)
    .map((person) => String(person && person.name ? person.name : "").trim())
    .filter(Boolean);
}

function formatLanguageLabel(languageCode) {
  const normalizedCode = String(languageCode || "").trim().toLowerCase();
  if (!normalizedCode) {
    return "Nao informado";
  }

  const knownLabels = {
    pt: "Portugues",
    en: "Ingles",
    es: "Espanhol",
    fr: "Frances",
    it: "Italiano",
    de: "Alemao",
    ja: "Japones",
    ko: "Coreano"
  };

  if (knownLabels[normalizedCode]) {
    return knownLabels[normalizedCode];
  }

  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    try {
      const displayNames = new Intl.DisplayNames(["pt-BR"], { type: "language" });
      return displayNames.of(normalizedCode) || normalizedCode.toUpperCase();
    } catch (error) {
      return normalizedCode.toUpperCase();
    }
  }

  return normalizedCode.toUpperCase();
}

function renderSimilarMovies(recommendations, isManual = false) {
  const grid = document.getElementById("similarMoviesGrid");
  if (!grid) {
    return;
  }

  if (isManual) {
    grid.innerHTML = `
      <div class="details-empty-state rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        Filmes manuais nao recebem recomendacoes automaticas do TMDB.
      </div>
    `;
    return;
  }

  const validRecommendations = Array.isArray(recommendations)
    ? recommendations.filter((item) => item && item.id && item.poster_path)
    : [];

  if (!validRecommendations.length) {
    grid.innerHTML = `
      <div class="details-empty-state rounded-3xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-400">
        Ainda nao encontramos titulos parecidos para este filme. Tente explorar o elenco, as reviews ou os links externos acima.
      </div>
    `;
    return;
  }

  grid.innerHTML = validRecommendations.slice(0, 8).map((item) => `
    <a class="details-similar-card" href="detalhes.html?id=${escapeHtml(String(item.id))}">
      <img alt="${escapeHtml(item.title || "Filme recomendado")}" class="details-similar-card__poster" decoding="async" loading="lazy" src="${window.TMDB.getImageUrl(item.poster_path, fallbackPoster)}" />
      <div class="details-similar-card__body">
        <div class="details-similar-card__meta">
          <span>${escapeHtml(item.release_date ? item.release_date.slice(0, 4) : "Sem ano")}</span>
          <span>${escapeHtml(buildStarSummaryLabel(item.vote_average))}</span>
        </div>
        <h3 class="details-similar-card__title">${escapeHtml(item.title || "Sem titulo")}</h3>
        <p class="details-similar-card__cta">
          Ver detalhes
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </p>
      </div>
    </a>
  `).join("");
}

function renderCommunitySignal(cinefyReviews = [], tmdbReviews = [], isManual = false) {
  const signal = document.getElementById("movieCommunitySignal");
  if (!signal) {
    return;
  }

  if (isManual) {
    signal.classList.add("hidden");
    signal.innerHTML = "";
    return;
  }

  const cinefyCount = Array.isArray(cinefyReviews) ? cinefyReviews.length : 0;
  const tmdbCount = Array.isArray(tmdbReviews) ? tmdbReviews.length : 0;
  const localAverage = calculateAverageReviewRating(cinefyReviews);

  let eyebrow = "Comunidade";
  let value = "Ainda nao ha conversa suficiente sobre este filme no Cinefy Club.";

  if (cinefyCount) {
    eyebrow = "No Cinefy Club";
    value = localAverage
      ? `${cinefyCount} review(s) locais com media ${localAverage.toFixed(1)}/5.`
      : `${cinefyCount} review(s) locais ja ajudam a dar o tom da comunidade.`;
  } else if (tmdbCount) {
    eyebrow = "Leitura rapida";
    value = `${tmdbCount} review(s) publicas do TMDB ja estao disponiveis para voce decidir o play com mais contexto.`;
  }

  signal.classList.remove("hidden");
  signal.innerHTML = `
    <div class="details-community-signal__copy">
      <span class="details-community-signal__eyebrow">${escapeHtml(eyebrow)}</span>
      <strong class="details-community-signal__value">${escapeHtml(value)}</strong>
    </div>
    <a class="details-community-signal__cta" href="#communityReviewsSection">
      <span class="material-symbols-outlined text-base">forum</span>
      Ir para reviews
    </a>
  `;
}

function buildReviewSummaryCards(cinefyReviews, tmdbReviews) {
  const cinefyCount = Array.isArray(cinefyReviews) ? cinefyReviews.length : 0;
  const tmdbCount = Array.isArray(tmdbReviews) ? tmdbReviews.length : 0;
  const localAverage = calculateAverageReviewRating(cinefyReviews);
  const cards = [
    {
      label: "Media local",
      value: localAverage ? `${localAverage.toFixed(1)}/5` : "Sem media local",
      hint: cinefyCount ? "Calculada com base nas reviews do Cinefy Club exibidas nesta pagina." : "A media aparece assim que voce e a comunidade avaliarem este filme."
    },
    {
      label: "Reviews locais",
      value: cinefyCount ? `${cinefyCount} review(s)` : "Sem reviews locais",
      hint: cinefyCount ? "Suas reviews e as dos seus amigos entram primeiro nesta conversa." : "Quando alguem avaliar este filme no app, a prova social local comeca aqui."
    },
    {
      label: "TMDB",
      value: tmdbCount ? `${tmdbCount} review(s)` : "Sem reviews externas",
      hint: tmdbCount ? "Leituras publicas importadas para dar contexto enquanto a comunidade cresce." : "Sem apoio externo no momento."
    }
  ];

  return cards.map((card) => `
    <div class="details-review-summary__card">
      <span class="details-review-summary__label">${escapeHtml(card.label)}</span>
      <strong class="details-review-summary__value">${escapeHtml(card.value)}</strong>
      <p class="details-review-summary__hint">${escapeHtml(card.hint)}</p>
    </div>
  `).join("");
}

function calculateAverageReviewRating(reviews) {
  const values = Array.isArray(reviews)
    ? reviews
      .map((review) => Number(review && review.ratingValue))
      .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (!values.length) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function getRegionLabel(regionCode) {
  const code = String(regionCode || "").toUpperCase();
  const knownLabels = {
    BR: "Brasil",
    US: "Estados Unidos",
    PT: "Portugal",
    FR: "França",
    ES: "Espanha",
    MX: "México",
    AR: "Argentina",
    IT: "Itália",
    DE: "Alemanha",
    GB: "Reino Unido"
  };

  if (knownLabels[code]) {
    return knownLabels[code];
  }

  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    try {
      const displayNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });
      return displayNames.of(code) || code;
    } catch (error) {
      return code;
    }
  }

  return code;
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
      label: "Ver no Letterboxd",
      href: `https://letterboxd.com/search/${encodeURIComponent(searchTerm)}/`
    };

    links.adoroCinema = {
      kicker: "Guia editorial",
      label: "Ver no AdoroCinema",
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
    authorAvatar: resolveUserAvatar(currentProfile),
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
        authorAvatar: data.authorAvatar || resolveUserAvatar(friend),
        sourceLabel: "Amigo no Cinefy Club",
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
    title: truncateText(currentMovie && currentMovie.title ? currentMovie.title : "", 120),
    poster: truncateText(currentMovie && currentMovie.poster_path ? window.TMDB.getImageUrl(currentMovie.poster_path, fallbackPoster) : "", 2048),
    authorUid: currentProfile.uid,
    authorName: truncateText(currentProfile.displayName || currentProfile.username || "Usuario", 80),
    authorUsername: truncateText(currentProfile.username || "", 24),
    authorAvatar: truncateText(resolveUserAvatar(currentProfile), 2048),
    rating: sanitizeReviewRating(reviewPayload.rating),
    comment: sanitizeReviewComment(reviewPayload.comment),
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
    authorUid: review.authorUid || review.uid || "",
    authorName: review.authorName || review.authorUsername || "Usuario",
    authorUsername: review.authorUsername || "",
    authorAvatar: review.authorAvatar || resolveUserAvatar({
      displayName: review.authorName || "",
      username: review.authorUsername || ""
    }),
    comment: comment || "Sem comentario.",
    ratingValue: Number.isFinite(ratingNumber) ? ratingNumber : null,
    updatedAt: review.updatedAt || "",
    sourceLabel: review.sourceLabel || "Review no Cinefy Club",
    isOwn: Boolean(review.isOwn),
    ratingLabel: Number.isFinite(ratingNumber) ? `${ratingNumber.toFixed(1)}/5` : "Sem nota",
    updatedLabel: formatReviewDate(review.updatedAt),
    tags: buildReviewTags(review),
    relationshipStatus: getRelationshipStatusForUser(review.authorUid || review.uid || "", Boolean(review.isOwn)),
    showFriendAction: Boolean(review.authorUid && currentProfile.uid && review.authorUid !== currentProfile.uid),
    authorHref: getPublicProfileHref({
      uid: review.authorUid || review.uid || "",
      username: review.authorUsername || "",
      displayName: review.authorName || "",
      avatar: review.authorAvatar || ""
    })
  };
}

function buildReviewTags(review) {
  const tags = [];

  if (review.isOwn) {
    tags.push("Sua review");
  } else if (review.sourceLabel === "Amigo no Cinefy Club") {
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

async function loadViewerRelationshipState() {
  if (!firestore || !currentProfile.uid) {
    relationshipState.loaded = true;
    return;
  }

  try {
    const viewerDoc = firestore.collection("users").doc(currentProfile.uid);
    const [friendsSnapshot, incomingSnapshot, outgoingSnapshot] = await Promise.all([
      viewerDoc.collection("friends").get(),
      viewerDoc.collection("friend_requests").get(),
      viewerDoc.collection("outgoing_requests").get()
    ]);

    relationshipState.friends = new Set(friendsSnapshot.docs.map((doc) => doc.id));
    relationshipState.incoming = new Set(incomingSnapshot.docs.map((doc) => doc.id));
    relationshipState.outgoing = new Set(outgoingSnapshot.docs.map((doc) => doc.id));
    relationshipState.loaded = true;
  } catch (error) {
    console.error("Erro ao carregar relacionamentos para reviews:", error);
    relationshipState.loaded = true;
  }

  if (currentMovie) {
    renderCommunityReviews(currentTmdbReviews, currentExternalLinks, Boolean(localMovieId), currentCinefyReviews);
  }
}

function getRelationshipStatusForUser(userId, isOwn) {
  if (!currentProfile.uid || !userId || isOwn) {
    return isOwn ? "own" : "available";
  }

  if (relationshipState.friends.has(userId)) {
    return "friend";
  }

  if (relationshipState.incoming.has(userId)) {
    return "incoming";
  }

  if (relationshipState.outgoing.has(userId)) {
    return "outgoing";
  }

  return "available";
}

function getRelationshipRefs(otherUserId) {
  return {
    currentFriend: firestore.collection("users").doc(currentProfile.uid).collection("friends").doc(otherUserId),
    otherFriend: firestore.collection("users").doc(otherUserId).collection("friends").doc(currentProfile.uid),
    currentIncoming: firestore.collection("users").doc(currentProfile.uid).collection("friend_requests").doc(otherUserId),
    currentOutgoing: firestore.collection("users").doc(currentProfile.uid).collection("outgoing_requests").doc(otherUserId),
    otherIncoming: firestore.collection("users").doc(otherUserId).collection("friend_requests").doc(currentProfile.uid),
    otherOutgoing: firestore.collection("users").doc(otherUserId).collection("outgoing_requests").doc(currentProfile.uid)
  };
}

async function commitRelationshipBatch(otherUserId, applyBatch) {
  const refs = getRelationshipRefs(otherUserId);
  const batch = firestore.batch();
  applyBatch(batch, refs);
  await batch.commit();
}

async function handleReviewSocialAction(action, targetUser) {
  if (!firestore || !currentProfile.uid || !targetUser || !targetUser.uid) {
    return;
  }

  if (action === "add") {
    await sendFriendRequestFromReview(targetUser);
    return;
  }

  if (action === "accept") {
    await acceptFriendRequestFromReview(targetUser);
  }
}

async function sendFriendRequestFromReview(targetUser) {
  const targetUid = String(targetUser.uid || "");
  if (!targetUid || relationshipState.outgoing.has(targetUid) || relationshipState.friends.has(targetUid)) {
    return;
  }

  try {
    const requestPayload = {
      senderUid: currentProfile.uid,
      displayName: currentProfile.displayName || currentProfile.username || "Usuario",
      username: currentProfile.username || "cinefyuser",
      avatar: resolveUserAvatar(currentProfile),
      createdAt: new Date().toISOString()
    };

    await Promise.all([
      firestore.collection("users").doc(targetUid).collection("friend_requests").doc(currentProfile.uid).set(requestPayload),
      firestore.collection("users").doc(currentProfile.uid).collection("outgoing_requests").doc(targetUid).set({
        recipientUid: targetUid,
        displayName: targetUser.displayName || targetUser.username || "Usuario",
        username: targetUser.username || "cinefyuser",
        avatar: resolveUserAvatar(targetUser),
        createdAt: new Date().toISOString()
      })
    ]);

    await appendNotificationToUser(targetUid, {
      id: `friend-request-${currentProfile.uid}`,
      type: "friend_request",
      title: "Pedido de amizade recebido",
      message: `${currentProfile.displayName || currentProfile.username || "Um usuario"} enviou um pedido de amizade.`,
      href: "amigos.html",
      read: false,
      createdAt: new Date().toISOString()
    });

    relationshipState.outgoing.add(targetUid);
    document.getElementById("reviewFeedback").textContent = `Pedido enviado para ${targetUser.displayName || "esse usuario"}.`;
    renderCommunityReviews(currentTmdbReviews, currentExternalLinks, Boolean(localMovieId), currentCinefyReviews);
  } catch (error) {
    console.error("Erro ao enviar pedido via review:", error);
    document.getElementById("reviewFeedback").textContent = "Nao foi possivel enviar o pedido agora.";
  }
}

async function acceptFriendRequestFromReview(targetUser) {
  const targetUid = String(targetUser.uid || "");
  if (!targetUid || !relationshipState.incoming.has(targetUid)) {
    return;
  }

  try {
    await commitRelationshipBatch(targetUid, (batch, refs) => {
      batch.set(refs.currentFriend, {
        id: targetUid,
        name: targetUser.displayName || targetUser.username || "Usuario",
        displayName: targetUser.displayName || targetUser.username || "Usuario",
        username: targetUser.username || "cinefyuser",
        avatar: resolveUserAvatar(targetUser),
        favoriteGenre: "Cinema",
        location: targetUser.location || "",
        createdAt: new Date().toISOString()
      });
      batch.set(refs.otherFriend, {
        id: currentProfile.uid,
        name: currentProfile.displayName || currentProfile.username || "Usuario",
        displayName: currentProfile.displayName || currentProfile.username || "Usuario",
        username: currentProfile.username || "cinefyuser",
        avatar: resolveUserAvatar(currentProfile),
        favoriteGenre: "Cinema",
        location: currentProfile.location || "",
        createdAt: new Date().toISOString()
      });
      batch.delete(refs.currentIncoming);
      batch.delete(refs.currentOutgoing);
      batch.delete(refs.otherIncoming);
      batch.delete(refs.otherOutgoing);
    });

    await appendNotificationToUser(targetUid, {
      id: `friend-accepted-${currentProfile.uid}`,
      type: "friend_accepted",
      title: "Pedido aceito",
      message: `${currentProfile.displayName || currentProfile.username || "Um usuario"} aceitou seu pedido de amizade.`,
      href: "amigos.html",
      read: false,
      createdAt: new Date().toISOString()
    });

    relationshipState.incoming.delete(targetUid);
    relationshipState.outgoing.delete(targetUid);
    relationshipState.friends.add(targetUid);
    document.getElementById("reviewFeedback").textContent = `${targetUser.displayName || "Esse usuario"} agora faz parte da sua rede.`;
    renderCommunityReviews(currentTmdbReviews, currentExternalLinks, Boolean(localMovieId), currentCinefyReviews);
  } catch (error) {
    console.error("Erro ao aceitar pedido via review:", error);
    document.getElementById("reviewFeedback").textContent = "Nao foi possivel aceitar esse pedido agora.";
  }
}

async function appendNotificationToUser(userId, notification) {
  try {
    const docRef = firestore.collection("users").doc(userId).collection("app_state").doc("notifications");
    const snapshot = await docRef.get();
    const current = snapshot.exists && Array.isArray(snapshot.data().value) ? snapshot.data().value : [];
    if (current.some((item) => item.id === notification.id)) return;
    await docRef.set({
      value: [notification, ...current].slice(0, 40),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error("Erro ao anexar notificacao remota:", error);
  }
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

function sanitizeReviewRating(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return "";

  const parsedValue = Number(candidate);
  if (!Number.isFinite(parsedValue)) return "";
  return String(Math.min(5, Math.max(0, parsedValue)));
}

function sanitizeReviewComment(value) {
  return truncateText(String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim(), 1600);
}

function truncateText(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

function getPublicProfileHref(user) {
  if (window.CinefyProfiles && typeof window.CinefyProfiles.buildPublicProfileHref === "function") {
    return window.CinefyProfiles.buildPublicProfileHref(user);
  }

  return "perfil.html";
}
