const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const crypto = require("node:crypto");

const tmdbApiKey = defineSecret("TMDB_API_KEY");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const FUNCTION_PREFIX = "/api/tmdb";
const ALLOWED_ORIGINS = new Set([
  "https://cinefyclub.com.br",
  "https://www.cinefyclub.com.br",
  "https://cinefy3-83a9a.web.app",
  "https://cinefy3-83a9a.firebaseapp.com",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
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
  /^\/movie\/\d+\/credits$/,
  /^\/movie\/\d+\/release_dates$/,
  /^\/movie\/\d+\/watch\/providers$/,
  /^\/movie\/\d+\/recommendations$/,
  /^\/movie\/\d+\/external_ids$/,
  /^\/movie\/\d+\/reviews$/
];
const ALLOWED_QUERY_PARAMS = new Set([
  "language",
  "page",
  "query",
  "include_adult"
]);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 90;
const requestBuckets = new Map();

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

function getClientIp(req) {
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) {
    return String(forwardedFor).split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function hashIdentifier(value) {
  return crypto.createHash("sha256").update(String(value || "unknown")).digest("hex").slice(0, 16);
}

function isRateLimited(clientIp) {
  const now = Date.now();
  const bucketKey = hashIdentifier(clientIp);

  if (requestBuckets.size > 500) {
    for (const [key, value] of requestBuckets.entries()) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) {
        requestBuckets.delete(key);
      }
    }
  }

  const bucket = requestBuckets.get(bucketKey);

  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(bucketKey, { count: 1, startedAt: now });
    return false;
  }

  bucket.count += 1;
  requestBuckets.set(bucketKey, bucket);
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function sanitizeQueryParam(key, value) {
  const stringValue = String(value ?? "").trim();
  if (!stringValue) return "";

  if (key === "page") {
    const page = Number(stringValue);
    return Number.isInteger(page) && page >= 1 && page <= 20 ? String(page) : "";
  }

  if (key === "query") {
    return stringValue.length <= 120 ? stringValue : stringValue.slice(0, 120);
  }

  if (key === "include_adult") {
    return stringValue === "true" ? "true" : "false";
  }

  if (key === "language") {
    return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(stringValue) ? stringValue : "";
  }

  return "";
}

exports.tmdbProxy = onRequest(
  {
    region: "southamerica-east1",
    timeoutSeconds: 30,
    secrets: [tmdbApiKey]
  },
  async (req, res) => {
    const origin = req.get("origin") || "";
    const clientIp = getClientIp(req);

    if (origin && isAllowedOrigin(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
    }

    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (!isAllowedOrigin(origin)) {
      console.warn("TMDB proxy blocked disallowed origin", { origin, client: hashIdentifier(clientIp) });
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }

    if (isRateLimited(clientIp)) {
      console.warn("TMDB proxy rate limited request", { client: hashIdentifier(clientIp), origin });
      res.set("Retry-After", "60");
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }

    const tmdbPath = resolveTmdbPath(req.path);
    if (!isAllowedTmdbPath(tmdbPath)) {
      console.warn("TMDB proxy blocked unsupported route", { path: tmdbPath, client: hashIdentifier(clientIp) });
      res.status(400).json({ error: "Unsupported TMDB route" });
      return;
    }

    const url = new URL(`${TMDB_BASE_URL}${tmdbPath}`);
    url.searchParams.set("api_key", tmdbApiKey.value().trim());
    url.searchParams.set("language", "pt-BR");

    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (!ALLOWED_QUERY_PARAMS.has(key)) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          const sanitizedEntry = sanitizeQueryParam(key, entry);
          if (sanitizedEntry) {
            url.searchParams.append(key, sanitizedEntry);
          }
        });
        return;
      }

      const sanitizedValue = sanitizeQueryParam(key, value);
      if (sanitizedValue) {
        url.searchParams.set(key, sanitizedValue);
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
