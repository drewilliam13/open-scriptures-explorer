import { describe, expect, it } from "vitest";
import {
  getChapterPayload,
  getTanakhSummary,
  resolveBookIdentifier,
} from "@/lib/scripture/repository";

describe("scripture repository", () => {
  it("loads the full Tanakh", () => {
    expect(getTanakhSummary()).toMatchObject({
      bookCount: 39,
      chapterCount: 929,
      verseCount: 23213,
      translation: "JPS 1917",
      hebrewSource: "HBOMAS",
      versification: "OSHB/MT",
    });
  });

  it("resolves book identifiers", () => {
    expect(resolveBookIdentifier("Genesis")).toBe("gen");
    expect(resolveBookIdentifier("Ex")).toBe("exo");
    expect(resolveBookIdentifier("Psalm")).toBe("psa");
  });

  it("loads Genesis 1", () => {
    expect(getChapterPayload("gen", 1)).toMatchObject({
      ok: true,
      chapter: {
        bookId: "gen",
        bookName: "Genesis",
        chapterNumber: 1,
      },
    });
  });

  it("loads Exodus 19", () => {
    expect(getChapterPayload("Exodus", 19)).toMatchObject({
      ok: true,
      chapter: {
        bookId: "exo",
        bookName: "Exodus",
        chapterNumber: 19,
      },
    });
  });

  it("loads later Tanakh chapters", () => {
    expect(getChapterPayload("Isaiah", 53)).toMatchObject({
      ok: true,
      chapter: {
        bookId: "isa",
        bookName: "Isaiah",
        chapterNumber: 53,
      },
    });
    expect(getChapterPayload("Psalm", 119)).toMatchObject({
      ok: true,
      chapter: {
        bookId: "psa",
        bookName: "Psalms",
        chapterNumber: 119,
      },
    });
  });

  it("uses OSHB/MT versification for Psalm titles and Malachi", () => {
    const psalmFive = getChapterPayload("Psalm", 5);
    expect(psalmFive.ok).toBe(true);
    expect(psalmFive.chapter.verses).toHaveLength(13);
    expect(psalmFive.chapter.verses[0]).toMatchObject({
      canonicalId: "PSA.005.001",
      reference: "Psalms 5:1",
      translations: {
        jps: {
          alignmentAction: "split",
        },
      },
    });
    expect(psalmFive.chapter.verses[0].englishText).toContain("For the Leader; upon the Nehiloth");
    expect(psalmFive.chapter.verses[1]).toMatchObject({
      canonicalId: "PSA.005.002",
      translations: {
        jps: {
          originalRef: "PSA.005.001",
        },
      },
    });
    expect(psalmFive.chapter.verses[1].englishText).toContain("Give ear to my words");

    const malachiThree = getChapterPayload("Malachi", 3);
    expect(malachiThree.ok).toBe(true);
    expect(malachiThree.chapter.verses).toHaveLength(24);
    expect(malachiThree.chapter.verses[23]).toMatchObject({
      canonicalId: "MAL.003.024",
      reference: "Malachi 3:24",
      translations: {
        jps: {
          originalRef: "MAL.004.006",
          displayRef: "Malachi 3:24",
          alignmentAction: "move_chapter",
        },
      },
    });

    expect(getChapterPayload("Malachi", 4)).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});
