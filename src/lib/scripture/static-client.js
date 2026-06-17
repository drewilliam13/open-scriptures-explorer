const MANIFEST_PATH = "/scriptures/manifest.json";

let manifestPromise = null;
const bookPromises = new Map();

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }

  return response.json();
}

export function clearStaticScriptureCache() {
  manifestPromise = null;
  bookPromises.clear();
}

export function getStaticScriptureManifest() {
  manifestPromise ??= fetchJson(MANIFEST_PATH).catch((error) => {
    manifestPromise = null;
    throw error;
  });
  return manifestPromise;
}

export async function getStaticScriptureBook(bookId) {
  const manifest = await getStaticScriptureManifest();
  const bookMeta = manifest.books.find((book) => book.id === bookId);
  if (!bookMeta) {
    return null;
  }

  if (!bookPromises.has(bookId)) {
    const bookPromise = fetchJson(bookMeta.path).catch((error) => {
      bookPromises.delete(bookId);
      throw error;
    });
    bookPromises.set(bookId, bookPromise);
  }

  return bookPromises.get(bookId);
}

export async function getStaticChapterPayload(bookId, chapterNumber) {
  const book = await getStaticScriptureBook(bookId);
  const parsedChapter = Number(chapterNumber);
  if (!book || !Number.isInteger(parsedChapter) || parsedChapter < 1) {
    return null;
  }

  const chapter = book.chapters.find((entry) => entry.chapterNumber === parsedChapter);
  if (!chapter) {
    return null;
  }

  return {
    bookId: book.id,
    bookName: book.nameEnglish,
    chapterNumber: parsedChapter,
    verses: chapter.verses,
  };
}
