import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit, resetRateLimitsForTests } from "@/lib/rate-limit";

describe("search rate limit", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    vi.unstubAllEnvs();
  });

  it("allows requests until the configured bucket is exhausted", () => {
    vi.stubEnv("SEARCH_RATE_LIMIT_MAX", "2");
    vi.stubEnv("SEARCH_RATE_LIMIT_WINDOW_SECONDS", "60");

    expect(consumeRateLimit("client-a", 1000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(consumeRateLimit("client-a", 1000)).toMatchObject({ allowed: true, remaining: 0 });
    expect(consumeRateLimit("client-a", 1000)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("opens a new bucket after the window resets", () => {
    vi.stubEnv("SEARCH_RATE_LIMIT_MAX", "1");
    vi.stubEnv("SEARCH_RATE_LIMIT_WINDOW_SECONDS", "1");

    expect(consumeRateLimit("client-a", 1000).allowed).toBe(true);
    expect(consumeRateLimit("client-a", 1000).allowed).toBe(false);
    expect(consumeRateLimit("client-a", 2001).allowed).toBe(true);
  });
});
