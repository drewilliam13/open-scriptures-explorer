import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "public", "scriptures", "manifest.json");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

describe("static scripture collection", () => {
  it("publishes OSHB/JPS manifest metadata", async () => {
    const manifest = await readJson(MANIFEST_PATH);

    expect(manifest.id).toBe("oshb-jps");
    expect(manifest.versification).toBe("OSHB/MT");
    expect(manifest.bookCount).toBe(39);
    expect(manifest.chapterCount).toBe(929);
    expect(manifest.verseCount).toBe(23213);
    expect(manifest.version).toMatch(/^[a-f0-9]{12}$/);
    expect(manifest.collectionGeneratedAt).toBeUndefined();
    expect(manifest.books[0]).toMatchObject({
      id: "gen",
    });
    expect(manifest.books[0].path).toBe(
      `/scriptures/oshb-jps/${manifest.version}/books/gen.json`,
    );
  });

  it("publishes one cacheable file per book", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const exodusMeta = manifest.books.find((book) => book.id === "exo");
    const exodus = await readJson(path.join(ROOT, "public", exodusMeta.path));
    const chapterNineteen = exodus.chapters.find((chapter) => chapter.chapterNumber === 19);

    expect(exodus.collectionId).toBe("oshb-jps");
    expect(chapterNineteen.verses[3].reference).toBe("Exodus 19:4");
    expect(chapterNineteen.verses[3].englishText).toContain("eagles' wings");
  });

  it("keeps OSHB/MT Malachi numbering in static files", async () => {
    const manifest = await readJson(MANIFEST_PATH);
    const malachiMeta = manifest.books.find((book) => book.id === "mal");
    const malachi = await readJson(path.join(ROOT, "public", malachiMeta.path));
    const chapterThree = malachi.chapters.find((chapter) => chapter.chapterNumber === 3);

    expect(malachi.chapterCount).toBe(3);
    expect(chapterThree.verses).toHaveLength(24);
    expect(chapterThree.verses[23].reference).toBe("Malachi 3:24");
    expect(chapterThree.verses[23].translations.jps.originalRef).toBe("MAL.004.006");
  });
});
