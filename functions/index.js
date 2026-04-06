const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const tmdbApiKey = defineSecret("TMDB_API_KEY");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const FUNCTION_PREFIX = "/api/tmdb";
const ALLOWED_ORIGINS = new Set([
  "https://cinefy3-83a9a.web.app",
  "https://cinefy3-83a9a.firebaseapp.com",
  "http://127.0.0.1:5500",
  "http://localhost:5000",
  "http://localhost:5500"
]);
const ALLOWED_PREFIXES = [
  "/search/movie",
  "/movie/popular",
  "/movie/top_rated",
  "/trending/movie/week"
];
const ALLOWED_EXACT_OR_REGEX = [
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/credits$/
];
const ALLOWED_QUERY_PARAMS = new Set([
  "language",
  "page",
  "query",
  "include_adult",
  "append_to_response"
]);

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function resolveTmdbPath(pathname) {
  const rawPath = String(pathname || "/");
  const normalizedPath = rawPath.startsWith(FUNCTION_PREFIX)
    ? rawPath.slice(FUNCTION_PREFIX.length) || "/"
    : rawPath;

  return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
}

function isAllowedTmdbPath(pathname) {
  if (ALLOWED_PREFIXES.includes(pathname)) {
    return true;
  }

  return ALLOWED_EXACT_OR_REGEX.some((pattern) => pattern.test(pathname));
}

exports.tmdbProxy = onRequest(
  {
    region: "southamerica-east1",
    timeoutSeconds: 30,
    secrets: [tmdbApiKey]
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!isAllowedOrigin(req.get("origin"))) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }

    const tmdbPath = resolveTmdbPath(req.path);
    if (!isAllowedTmdbPath(tmdbPath)) {
      res.status(400).json({ error: "Unsupported TMDB route" });
      return;
    }

    const url = new URL(`${TMDB_BASE_URL}${tmdbPath}`);
    url.searchParams.set("api_key", tmdbApiKey.value());
    url.searchParams.set("language", "pt-BR");

    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (!ALLOWED_QUERY_PARAMS.has(key)) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry !== undefined && entry !== null && entry !== "") {
            url.searchParams.append(key, String(entry));
          }
        });
        return;
      }

      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json"
        }
      });

      const payload = await response.text();
      res.status(response.status);
      res.set("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=600");
      res.send(payload);
    } catch (error) {
      console.error("Erro ao consultar o TMDB via proxy:", error);
      res.status(502).json({ error: "TMDB proxy request failed" });
    }
  }
);
