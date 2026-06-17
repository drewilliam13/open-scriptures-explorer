import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/chapter/route";

describe("/api/chapter", () => {
  it("returns Genesis content", async () => {
    const response = await GET(new Request("http://localhost/api/chapter?book=gen&chapter=1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.chapter.bookId).toBe("gen");
    expect(payload.chapter.verses[0].reference).toBe("Genesis 1:1");
  });

  it("returns Exodus content", async () => {
    const response = await GET(new Request("http://localhost/api/chapter?book=exo&chapter=19"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.chapter.bookId).toBe("exo");
    expect(payload.chapter.verses[3].reference).toBe("Exodus 19:4");
  });

  it("returns later Tanakh content", async () => {
    const response = await GET(new Request("http://localhost/api/chapter?book=isa&chapter=53"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.chapter.bookId).toBe("isa");
    expect(payload.chapter.verses.length).toBeGreaterThan(0);
    expect(payload.chapter.verses[0].hebrewText).not.toBe("");
    expect(payload.chapter.verses[0].englishText).not.toBe("");
  });

  it("uses OSHB/MT Malachi chapter numbering", async () => {
    const response = await GET(new Request("http://localhost/api/chapter?book=mal&chapter=3"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.chapter.verses).toHaveLength(24);
    expect(payload.chapter.verses[23].reference).toBe("Malachi 3:24");
    expect(payload.chapter.verses[23].translations.jps.originalRef).toBe("MAL.004.006");

    const missingResponse = await GET(new Request("http://localhost/api/chapter?book=mal&chapter=4"));
    expect(missingResponse.status).toBe(404);
  });
});
