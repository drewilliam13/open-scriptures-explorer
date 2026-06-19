import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverOpenAiReferences } from "@/lib/search/openai-reference-provider";

describe("OpenAI reference provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("aborts optional AI discovery after the configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_TIMEOUT_MS", "25");

    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
      ),
    );

    const promise = discoverOpenAiReferences("weak local query");
    const assertion = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
