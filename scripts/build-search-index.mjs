import fs from "node:fs/promises";
import path from "node:path";
import tanakh from "../src/data/tanakh.json" with { type: "json" };

const OUTPUT_PATH = path.join(process.cwd(), "src/data/search-index.json");

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "does",
  "for",
  "from",
  "he",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "say",
  "says",
  "the",
  "to",
  "unto",
  "where",
  "with",
  "you",
]);

const entries = tanakh.books.flatMap((book) =>
  book.chapters.flatMap((chapter) =>
    chapter.verses.map((verse) => ({
      bookId: book.id,
      chapter: chapter.chapterNumber,
      verse: verse.verseNumber,
      reference: verse.reference,
      english: normalizeSearchText(verse.englishText),
      hebrew: normalizeSearchText(verse.hebrewText),
      tokens: tokenize(`${verse.englishText} ${verse.hebrewText}`),
      sortOrder: verse.sortOrder,
    })),
  ),
);
const byToken = {};

entries.forEach((entry, index) => {
  for (const token of new Set(entry.tokens)) {
    byToken[token] ??= [];
    byToken[token].push(index);
  }
});

await fs.writeFile(
  OUTPUT_PATH,
  `${JSON.stringify({
    generatedFrom: tanakh.generatedAt,
    verseCount: entries.length,
    entries,
    byToken,
  })}\n`,
);

console.log(`Built search index with ${entries.length} verses.`);

function tokenize(value) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => {
      if (token.length > 4 && token.endsWith("s")) {
        return token.slice(0, -1);
      }
      return token;
    })
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7]/g, "")
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
