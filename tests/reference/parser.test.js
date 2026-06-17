import { describe, expect, it } from "vitest";
import { parseReference } from "@/lib/reference/parser";

describe("parseReference", () => {
  it("parses a full book chapter reference", () => {
    expect(parseReference("Genesis 1")).toEqual({
      ok: true,
      reference: {
        bookId: "gen",
        bookName: "Genesis",
        chapter: 1,
        verseStart: null,
        verseEnd: null,
      },
    });
  });

  it("parses common abbreviations and verses", () => {
    expect(parseReference("Deut 30:6")).toMatchObject({
      ok: true,
      reference: {
        bookId: "deu",
        bookName: "Deuteronomy",
        chapter: 30,
        verseStart: 6,
        verseEnd: 6,
      },
    });
  });

  it("rejects unknown books", () => {
    expect(parseReference("Romans 2:29")).toEqual({
      ok: false,
      error: "Unknown book.",
    });
  });

  it("rejects chapters outside the book range", () => {
    expect(parseReference("Isaiah 99")).toEqual({
      ok: false,
      error: "Chapter is outside the valid range.",
    });
  });

  it("uses OSHB/MT chapter ranges", () => {
    expect(parseReference("Joel 4")).toMatchObject({
      ok: true,
      reference: {
        bookId: "jol",
        chapter: 4,
      },
    });
    expect(parseReference("Malachi 4")).toEqual({
      ok: false,
      error: "Chapter is outside the valid range.",
    });
  });
});
