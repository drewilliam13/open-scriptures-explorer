import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterRankedResults,
  getDirectReferenceResults,
  mergeResults,
  searchScripture,
  searchLocalText,
  shouldUseAiDiscovery,
  validateReferenceResult,
} from "@/lib/search/scripture-search";

describe("scripture search", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns direct references as validated canonical results", () => {
    expect(getDirectReferenceResults("Exodus 19:4")).toEqual([
      expect.objectContaining({
        reference: "Exodus 19:4",
        bookId: "exo",
        chapter: 19,
        verseStart: 4,
        verseEnd: 4,
        source: "direct",
      }),
    ]);
  });

  it("does not treat ambiguous short aliases inside prose as direct references", async () => {
    const payload = await searchScripture("why is 40 years important", { disableAi: true });

    expect(payload.sources.direct).toBe(false);
    expect(payload.results).not.toEqual([
      expect.objectContaining({
        reference: "Isaiah 40:1-31",
        source: "direct",
      }),
    ]);
  });

  it("expands chapter-only references to the whole chapter range", () => {
    expect(getDirectReferenceResults("Isaiah 53")).toEqual([
      expect.objectContaining({
        reference: "Isaiah 53:1-12",
        bookId: "isa",
        chapter: 53,
        verseStart: 1,
        verseEnd: 12,
        source: "direct",
      }),
    ]);
  });

  it("rejects invalid verse references", () => {
    expect(validateReferenceResult({ reference: "Genesis 1:999", confidence: 1 })).toBeNull();
    expect(validateReferenceResult({ reference: "Romans 8:28", confidence: 1 })).toBeNull();
  });

  it("does not preserve AI-provided explanations in validated results", () => {
    expect(
      validateReferenceResult({
        reference: "Exodus 19:4",
        confidence: 0.8,
        source: "ai",
        reason: "The verse says...",
      }),
    ).toMatchObject({
      source: "ai",
      reason: "AI-proposed reference validated against local scripture data",
    });
  });

  it("deduplicates repeated references and keeps the highest confidence", () => {
    const results = mergeResults([
      validateReferenceResult({ reference: "Exodus 19:4", confidence: 0.4, source: "local" }),
      validateReferenceResult({ reference: "Exodus 19:4", confidence: 0.9, source: "direct" }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      reference: "Exodus 19:4",
      confidence: 0.9,
      source: "direct",
    });
  });

  it("finds remembered local wording without returning scripture quotations", () => {
    const results = searchLocalText("eagles wings");

    expect(results[0]).toMatchObject({
      reference: "Exodus 19:4",
      bookId: "exo",
      chapter: 19,
      verseStart: 4,
      source: "local",
    });
    expect(results[0]).not.toHaveProperty("englishText");
    expect(results[0]).not.toHaveProperty("hebrewText");
  });

  it("seeds local candidates from synonym tokens", () => {
    const results = searchLocalText("torah");

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.source === "local")).toBe(true);
  });

  it("finds local Hebrew text without requiring vowel marks", () => {
    const results = searchLocalText("בראשית ברא");

    expect(results[0]).toMatchObject({
      reference: "Genesis 1:1",
      bookId: "gen",
      chapter: 1,
      verseStart: 1,
      source: "local",
    });
  });

  it("finds Hebrew phrases when users omit Hebrew punctuation", () => {
    const results = searchLocalText("על פני תהום");

    expect(results[0]).toMatchObject({
      reference: "Genesis 1:2",
      bookId: "gen",
      chapter: 1,
      verseStart: 2,
      source: "local",
    });
  });

  it("does not use online discovery when local search has a strong verified match", () => {
    const results = searchLocalText("eagles wings");

    expect(shouldUseAiDiscovery(results)).toBe(false);
  });

  it("finds cross-translation remembered wording as the top local result", async () => {
    const payload = await searchScripture("to the law and the testimony if its not according to this", {
      disableAi: true,
    });

    expect(payload.results).toEqual([
      expect.objectContaining({
        reference: "Isaiah 8:20",
        bookId: "isa",
        chapter: 8,
        verseStart: 20,
        source: "local",
      }),
    ]);
  });

  it("filters low-confidence debug matches when a strong result exists", () => {
    const results = filterRankedResults([
      validateReferenceResult({ reference: "Isaiah 8:20", confidence: 0.9, source: "local" }),
      validateReferenceResult({ reference: "Joshua 1:8", confidence: 0.49, source: "local" }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].reference).toBe("Isaiah 8:20");
  });
});
