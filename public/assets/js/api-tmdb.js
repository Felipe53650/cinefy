// api-tmdb.js - Integracao com a API do TMDB
(function () {
  const TMDB_API_KEY = "001848de646b91395482c1af23be80a8";
  const TMDB_BASE_URL = "https://api.themoviedb.org/3";
  const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
  const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/original";

  async function tmdbFetch(path, params = {}) {
    const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
    const url = new URL(`${TMDB_BASE_URL}${normalizedPath}`);

    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("language", "pt-BR");

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
    getImageUrl,
    getBackdropUrl
  };
})();
