// api-tmdb.js - Integracao com a API do TMDB
(function () {
  const TMDB_PROXY_BASE_URL = resolveTmdbProxyBaseUrl();
  const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
  const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/original";
  const movieCertificationCache = new Map();

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

  async function getMovieCertificationLabel(movieId) {
    if (!movieId) {
      throw new Error("movieId is required");
    }

    const normalizedMovieId = String(movieId).trim();
    if (movieCertificationCache.has(normalizedMovieId)) {
      return movieCertificationCache.get(normalizedMovieId);
    }

    const releaseDates = await getMovieReleaseDates(normalizedMovieId);
    const certificationLabel = extractMovieCertificationLabel(releaseDates);
    movieCertificationCache.set(normalizedMovieId, certificationLabel);
    return certificationLabel;
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

  function extractMovieCertificationLabel(releaseDatesPayload) {
    const results = Array.isArray(releaseDatesPayload && releaseDatesPayload.results)
      ? releaseDatesPayload.results
      : [];
    const prioritizedEntries = [
      results.find((item) => item.iso_3166_1 === "BR"),
      results.find((item) => item.iso_3166_1 === "US"),
      ...results
    ].filter(Boolean);

    for (const entry of prioritizedEntries) {
      const releaseDates = Array.isArray(entry.release_dates) ? entry.release_dates : [];
      for (const releaseDate of releaseDates) {
        const normalizedCertification = normalizeCertificationLabel(releaseDate.certification, entry.iso_3166_1);
        if (normalizedCertification) {
          return normalizedCertification;
        }
      }
    }

    return "";
  }

  function normalizeCertificationLabel(value, countryCode) {
    const rawValue = String(value || "").trim().toUpperCase();
    if (!rawValue) return "";

    if (countryCode === "BR") {
      if (rawValue === "L" || rawValue === "LIVRE") return "L";
      if (["10", "12", "14", "16", "18"].includes(rawValue)) return rawValue;
    }

    if (rawValue === "G" || rawValue === "TV-G" || rawValue === "L") return "L";
    if (rawValue === "PG" || rawValue === "TV-PG" || rawValue === "10") return "10";
    if (rawValue === "PG-13" || rawValue === "TV-14" || rawValue === "12" || rawValue === "13") return "12";
    if (rawValue === "14") return "14";
    if (rawValue === "15" || rawValue === "16" || rawValue === "M") return "16";
    if (rawValue === "17" || rawValue === "18" || rawValue === "R" || rawValue === "NC-17" || rawValue === "TV-MA") return "18";

    const numericValue = Number(rawValue.replace(/[^\d]/g, ""));
    if (!Number.isFinite(numericValue)) return "";
    if (numericValue <= 0) return "L";
    if (numericValue <= 10) return "10";
    if (numericValue <= 12) return "12";
    if (numericValue <= 14) return "14";
    if (numericValue <= 16) return "16";
    return "18";
  }

  window.TMDB = {
    searchMovies,
    getPopularMovies,
    getTopRatedMovies,
    getTrendingMovies,
    getMovieDetails,
    getMovieCredits,
    getMovieReleaseDates,
    getMovieCertificationLabel,
    getMovieWatchProviders,
    getMovieRecommendations,
    getMovieExternalIds,
    getMovieReviews,
    getImageUrl,
    getBackdropUrl
  };
})();
