import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import tanakh from "../src/data/tanakh.json" with { type: "json" };

const ROOT = process.cwd();
const COLLECTION_ID = "oshb-jps";
const OUTPUT_ROOT = path.join(ROOT, "public", "scriptures");
const COLLECTION_ROOT = path.join(OUTPUT_ROOT, COLLECTION_ID);
const COLLECTION_VERSION = crypto
  .createHash("sha256")
  .update(JSON.stringify(tanakh))
  .digest("hex")
  .slice(0, 12);
const BOOKS_ROOT = path.join(COLLECTION_ROOT, COLLECTION_VERSION, "books");

function buildManifest() {
  return {
    id: COLLECTION_ID,
    name: "OSHB Hebrew + JPS 1917 English",
    version: COLLECTION_VERSION,
    generatedAt: tanakh.generatedAt,
    translation: tanakh.translation,
    hebrewSource: tanakh.hebrewSource,
    versification: tanakh.versification,
    bookCount: tanakh.bookCount,
    chapterCount: tanakh.chapterCount,
    verseCount: tanakh.verseCount,
    alignmentSummary: tanakh.alignmentSummary,
    books: tanakh.books.map((book) => ({
      id: book.id,
      sourceId: book.sourceId,
      nameEnglish: book.nameEnglish,
      nameHebrew: book.nameHebrew,
      chapterCount: book.chapterCount,
      verseCount: book.verseCount,
      path: `/scriptures/${COLLECTION_ID}/${COLLECTION_VERSION}/books/${book.id}.json`,
    })),
  };
}

function buildBook(book) {
  return {
    collectionId: COLLECTION_ID,
    id: book.id,
    sourceId: book.sourceId,
    nameEnglish: book.nameEnglish,
    nameHebrew: book.nameHebrew,
    chapterCount: book.chapterCount,
    verseCount: book.verseCount,
    chapters: book.chapters,
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`);
}

async function main() {
  await fs.rm(COLLECTION_ROOT, { recursive: true, force: true });
  await fs.mkdir(BOOKS_ROOT, { recursive: true });

  await writeJson(path.join(OUTPUT_ROOT, "manifest.json"), buildManifest());

  for (const book of tanakh.books) {
    await writeJson(path.join(BOOKS_ROOT, `${book.id}.json`), buildBook(book));
  }

  console.log(
    `Built ${COLLECTION_ID} collection with ${tanakh.bookCount} books, ${tanakh.chapterCount} chapters, ${tanakh.verseCount} verses.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
