import { findBook } from "@/lib/reference/books";
import tanakh from "@/data/tanakh.json";

export function resolveBookIdentifier(value) {
  const direct = findBook(value);
  if (direct) {
    return direct.id;
  }

  const normalized = value.toLowerCase().trim();
  const dataBook = tanakh.books.find((book) => {
    return book.id === normalized || book.nameEnglish.toLowerCase() === normalized;
  });
  if (dataBook) {
    return dataBook.id;
  }

  return null;
}

export function getTanakhSummary() {
  return {
    generatedAt: tanakh.generatedAt,
    translation: tanakh.translation,
    hebrewSource: tanakh.hebrewSource,
    versification: tanakh.versification,
    bookCount: tanakh.bookCount,
    chapterCount: tanakh.chapterCount,
    verseCount: tanakh.verseCount,
    alignmentWarningCount: tanakh.alignmentWarnings.length,
    alignmentSummary: tanakh.alignmentSummary,
    books: tanakh.books.map((book) => ({
      id: book.id,
      sourceId: book.sourceId,
      nameEnglish: book.nameEnglish,
      nameHebrew: book.nameHebrew,
      chapterCount: book.chapterCount,
      verseCount: book.verseCount,
    })),
  };
}

export function getChapterPayload(bookValue, chapterValue) {
  const bookId = resolveBookIdentifier(bookValue);
  if (!bookId) {
    return { ok: false, status: 404, error: "Unknown book." };
  }

  const chapterNumber = Number(chapterValue);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
    return { ok: false, status: 400, error: "Invalid chapter number." };
  }

  const book = tanakh.books.find((candidate) => candidate.id === bookId);
  const chapter = book?.chapters.find((candidate) => candidate.chapterNumber === chapterNumber);
  if (!chapter) {
    return { ok: false, status: 404, error: "Chapter not available." };
  }

  return {
    ok: true,
    chapter: {
      bookId,
      bookName: book.nameEnglish,
      chapterNumber,
      verses: chapter.verses,
    },
  };
}
