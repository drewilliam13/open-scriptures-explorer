import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverOpenAiReferences } from "@/lib/search/openai-reference-provider";

describe("OpenAI reference provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("requests reference-only JSON without hosted search tools", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({ results: [] }),
        }),
      ),
    );

    await discoverOpenAiReferences("by his wounds we are healed");

    const [, init] = fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    const serializedBody = JSON.stringify(body);
    const systemPrompt = body.input[0].content[0].text;

    expect(body).not.toHaveProperty("tools");
    expect(serializedBody).not.toContain("web_search");
    expect(systemPrompt).not.toContain("Use web search");
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe("json_schema");
  });

  it("parses structured reference results from the Responses API", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    results: [
                      {
                        reference: "Isaiah 53:5",
                        confidence: 0.92,
                        reason: "Recognized remembered wording",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
      ),
    );

    await expect(discoverOpenAiReferences("by his wounds we are healed")).resolves.toEqual([
      {
        reference: "Isaiah 53:5",
        confidence: 0.92,
        reason: "Recognized remembered wording",
      },
    ]);
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
