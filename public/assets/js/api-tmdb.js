// api-tmdb.js - Integracao com a API do TMDB
(function () {
  const TMDB_PROXY_BASE_URL = resolveTmdbProxyBaseUrl();
  const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
  const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/original";

  async function tmdbFetch(path, params = {}) {
    const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
    const url = new URL(`${TMDB_PROXY_BASE_URL}${normalizedPath}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDB request failed with status ${response.status}`);
    }

    return response.json();
  }

  function resolveTmdbProxyBaseUrl() {
    const projectId = window.CinefyFirebase && window.CinefyFirebase.config
      ? window.CinefyFirebase.config.projectId
      : "cinefy3-83a9a";
    const functionBaseUrl = `https://southamerica-east1-${projectId}.cloudfunctions.net/tmdbProxy`;
    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    return isLocalHost ? functionBaseUrl : `${window.location.origin}/api/tmdb`;
  }

  async function searchMovies(query, page = 1) {
    if (!query || !query.trim()) {
      return [];
    }

    const data = await tmdbFetch("/search/movie", {
      query: query.trim(),
      page,
      include_adult: "false"
    });

    return data.results || [];
  }

  async function getPopularMovies(page = 1) {
    const data = await tmdbFetch("/movie/popular", { page });
    return data.results || [];
  }

  async function getTopRatedMovies(page = 1) {
    const data = await tmdbFetch("/movie/top_rated", { page });
    return data.results || [];
  }

  async function getTrendingMovies(page = 1) {
    const data = await tmdbFetch("/trending/movie/week", { page });
    return data.results || [];
  }

  async function getMovieDetails(movieId) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    return tmdbFetch(`/movie/${movieId}`);
  }

  async function getMovieCredits(movieId) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    return tmdbFetch(`/movie/${movieId}/credits`);
  }

  async function getMovieReleaseDates(movieId) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    return tmdbFetch(`/movie/${movieId}/release_dates`);
  }

  async function getMovieWatchProviders(movieId) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    return tmdbFetch(`/movie/${movieId}/watch/providers`);
  }

  async function getMovieRecommendations(movieId, page = 1) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    const data = await tmdbFetch(`/movie/${movieId}/recommendations`, { page });
    return data.results || [];
  }

  async function getMovieExternalIds(movieId) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    return tmdbFetch(`/movie/${movieId}/external_ids`);
  }

  async function getMovieReviews(movieId, page = 1) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    return tmdbFetch(`/movie/${movieId}/reviews`, { page });
  }

  function getImageUrl(path, fallback = "") {
    return path ? `${TMDB_IMAGE_URL}${path}` : fallback;
  }

  function getBackdropUrl(path, fallback = "") {
    return path ? `${TMDB_BACKDROP_URL}${path}` : fallback;
  }

  window.TMDB = {
    searchMovies,
    getPopularMovies,
    getTopRatedMovies,
    getTrendingMovies,
    getMovieDetails,
    getMovieCredits,
    getMovieReleaseDates,
    getMovieWatchProviders,
    getMovieRecommendations,
    getMovieExternalIds,
    getMovieReviews,
    getImageUrl,
    getBackdropUrl
  };
})();
