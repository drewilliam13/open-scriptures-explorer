import { findBook } from "./books";

const REFERENCE_PATTERN = /^(.+?)\s+(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/;

export function parseReference(input) {
  const normalizedInput = input.trim().replace(/\s+/g, " ");
  const match = normalizedInput.match(REFERENCE_PATTERN);

  if (!match) {
    return { ok: false, error: "Reference must include a book and chapter." };
  }

  const [, bookName, chapterText, verseStartText, verseEndText] = match;
  const book = findBook(bookName);

  if (!book) {
    return { ok: false, error: "Unknown book." };
  }

  const chapter = Number(chapterText);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return { ok: false, error: "Chapter is outside the valid range." };
  }

  const verseStart = verseStartText ? Number(verseStartText) : null;
  const verseEnd = verseEndText ? Number(verseEndText) : verseStart;

  if (verseStart !== null && (!Number.isInteger(verseStart) || verseStart < 1)) {
    return { ok: false, error: "Verse is outside the valid range." };
  }

  if (verseEnd !== null && (!Number.isInteger(verseEnd) || verseEnd < verseStart)) {
    return { ok: false, error: "Verse range is invalid." };
  }

  return {
    ok: true,
    reference: {
      bookId: book.id,
      bookName: book.nameEnglish,
      chapter,
      verseStart,
      verseEnd,
    },
  };
}
