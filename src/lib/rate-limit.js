const DEFAULT_SEARCH_RATE_LIMIT_MAX = 30;
const DEFAULT_SEARCH_RATE_LIMIT_WINDOW_SECONDS = 60;

const buckets = new Map();

export function getSearchRateLimitConfig() {
  return {
    maxRequests: readPositiveInt("SEARCH_RATE_LIMIT_MAX", DEFAULT_SEARCH_RATE_LIMIT_MAX),
    windowSeconds: readPositiveInt(
      "SEARCH_RATE_LIMIT_WINDOW_SECONDS",
      DEFAULT_SEARCH_RATE_LIMIT_WINDOW_SECONDS,
    ),
  };
}

export function consumeRateLimit(key, nowMs = Date.now()) {
  const { maxRequests, windowSeconds } = getSearchRateLimitConfig();
  const normalizedKey = key || "anonymous";
  const windowMs = windowSeconds * 1000;
  const existing = buckets.get(normalizedKey);

  // This is a per-runtime guard for Vercel/serverless. It protects accidental
  // bursts now and keeps the API surface ready for replacing the backing store
  // with Redis/KV if traffic requires global rate limits later.
  if (!existing || existing.resetAt <= nowMs) {
    const resetAt = nowMs + windowMs;
    buckets.set(normalizedKey, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: Math.ceil(resetAt / 1000),
      resetIn: windowSeconds,
    };
  }

  const resetIn = Math.max(0, Math.ceil((existing.resetAt - nowMs) / 1000));

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Math.ceil(existing.resetAt / 1000),
      resetIn,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetAt: Math.ceil(existing.resetAt / 1000),
    resetIn,
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
}

function readPositiveInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
