import { searchScripture } from "@/lib/search/scripture-search";
import { consumeRateLimit, getSearchRateLimitConfig } from "@/lib/rate-limit";

export async function POST(request) {
  const startedAt = Date.now();
  const rateLimit = consumeRateLimit(getClientKey(request));
  const rateLimitHeaders = getRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many search requests. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON payload." },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (query.length < 2) {
    return Response.json(
      { error: "Search query must be at least 2 characters." },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  try {
    const searchPayload = await searchScripture(query);
    const durationMs = Date.now() - startedAt;

    if (durationMs > 1500) {
      console.info("Slow scripture search", {
        durationMs,
        resultCount: searchPayload.results.length,
        sources: searchPayload.sources,
      });
    }

    return Response.json(
      { ...searchPayload, durationMs },
      { headers: rateLimitHeaders },
    );
  } catch (error) {
    console.error("Scripture search failed", { error });
    return Response.json(
      { error: "Search failed." },
      { status: 500, headers: rateLimitHeaders },
    );
  }
}

function getClientKey(request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "local";
}

function getRateLimitHeaders(rateLimit) {
  const config = getSearchRateLimitConfig();

  return {
    "RateLimit-Limit": String(config.maxRequests),
    "RateLimit-Remaining": String(rateLimit.remaining),
    "RateLimit-Reset": String(rateLimit.resetAt),
  };
}
