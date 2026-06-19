import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

describe("/api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports launch-critical scripture and search configuration", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("SEARCH_RATE_LIMIT_MAX", "12");
    vi.stubEnv("SEARCH_RATE_LIMIT_WINDOW_SECONDS", "30");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "ok",
      app: "Open Scripture Explorer",
      scripture: {
        bookCount: 39,
        chapterCount: 929,
      },
      search: {
        aiConfigured: false,
        rateLimit: {
          maxRequests: 12,
          windowSeconds: 30,
        },
      },
    });
    expect(payload.scripture.verseCount).toBeGreaterThan(23000);
  });
});
