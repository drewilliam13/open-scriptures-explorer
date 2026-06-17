import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "src", "data", "tanakh.json");
const SOURCES_PATH = path.join(ROOT, "src", "data", "sources.json");
const API_BASE = "https://bible.helloao.org";
const EXPECTED_COUNTS = {
  books: 39,
  chapters: 929,
  verses: 23213,
};

const TANAKH_BOOK_IDS = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
];

const LOCAL_BOOK_IDS = {
  GEN: "gen",
  EXO: "exo",
  LEV: "lev",
  NUM: "num",
  DEU: "deu",
  JOS: "jos",
  JDG: "jdg",
  RUT: "rut",
  "1SA": "1sa",
  "2SA": "2sa",
  "1KI": "1ki",
  "2KI": "2ki",
  "1CH": "1ch",
  "2CH": "2ch",
  EZR: "ezr",
  NEH: "neh",
  EST: "est",
  JOB: "job",
  PSA: "psa",
  PRO: "pro",
  ECC: "ecc",
  SNG: "sng",
  ISA: "isa",
  JER: "jer",
  LAM: "lam",
  EZK: "ezk",
  DAN: "dan",
  HOS: "hos",
  JOL: "jol",
  AMO: "amo",
  OBA: "oba",
  JON: "jon",
  MIC: "mic",
  NAM: "nam",
  HAB: "hab",
  ZEP: "zep",
  HAG: "hag",
  ZEC: "zec",
  MAL: "mal",
};

async function fetchJson(pathname) {
  const response = await fetch(`${API_BASE}${pathname}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${pathname}: ${response.status}`);
  }

  return response.json();
}

function flattenContent(content) {
  if (!Array.isArray(content)) {
    return typeof content === "string" ? content : "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part?.content) {
        return flattenContent(part.content);
      }
      return "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function bookById(translation) {
  return new Map(translation.books.map((book) => [book.id, book]));
}

function padNumber(value) {
  return String(value).padStart(3, "0");
}

function buildCanonicalId(sourceBookId, chapterNumber, verseNumber) {
  return `${sourceBookId}.${padNumber(chapterNumber)}.${padNumber(verseNumber)}`;
}

function buildDisplayReference(bookName, chapterNumber, verseNumber) {
  return `${bookName} ${chapterNumber}:${verseNumber}`;
}

function buildSourceRef(sourceBookId, chapterNumber, verseNumber) {
  return buildCanonicalId(sourceBookId, chapterNumber, verseNumber);
}

function flattenBookVerses(book) {
  return book.chapters.flatMap((chapterEntry) => {
    const chapterNumber = chapterEntry.chapter.number;
    return chapterEntry.chapter.content
      .filter((item) => item.type === "verse")
      .map((item) => ({
        bookId: book.id,
        bookName: book.name,
        chapterNumber,
        verseNumber: item.number,
        ref: buildSourceRef(book.id, chapterNumber, item.number),
        displayRef: buildDisplayReference(book.name, chapterNumber, item.number),
        text: flattenContent(item.content),
      }));
  });
}

const JPS_MARKER_PATTERN = /\((\d{1,3})-(\d{1,3})\)\s*/g;

function cleanJpsText(value) {
  return value.replace(JPS_MARKER_PATTERN, "").replace(/\s+/g, " ").trim();
}

function getJpsAlignmentAction(rawVerse, targetChapter, targetVerse, markerCount) {
  if (rawVerse.chapterNumber === targetChapter && rawVerse.verseNumber === targetVerse && markerCount === 0) {
    return "same";
  }
  if (rawVerse.chapterNumber !== targetChapter) {
    return "move_chapter";
  }
  if (markerCount > 1) {
    return "split";
  }
  return "marker";
}

function buildMismatchChapters(hebrewBook, englishBook) {
  const chapters = new Set();
  const maxChapter = Math.max(hebrewBook.chapters.length, englishBook.chapters.length);

  for (let index = 0; index < maxChapter; index += 1) {
    const hebrewChapter = hebrewBook.chapters[index];
    const englishChapter = englishBook.chapters[index];
    const hebrewCount = hebrewChapter?.chapter.content.filter((item) => item.type === "verse").length ?? 0;
    const englishCount = englishChapter?.chapter.content.filter((item) => item.type === "verse").length ?? 0;
    if (hebrewCount !== englishCount) {
      chapters.add(index + 1);
    }
  }

  return chapters;
}

function splitUnmarkedPsalmTitle(text) {
  const bodyStarts = ["O God,", "O LORD,", "LORD,", "Give ear", "Hearken", "Save me"];
  const bodyIndex = bodyStarts
    .map((bodyStart) => text.indexOf(bodyStart))
    .filter((index) => index > 0)
    .sort((left, right) => left - right)[0];

  if (!bodyIndex) {
    return null;
  }

  return {
    title: cleanJpsText(text.slice(0, bodyIndex)),
    body: cleanJpsText(text.slice(bodyIndex)),
  };
}

function countChapterVerses(book, chapterNumber) {
  const chapter = book.chapters.find((entry) => entry.chapter.number === chapterNumber);
  return chapter?.chapter.content.filter((item) => item.type === "verse").length ?? 0;
}

function buildJpsSegments(englishBook, hebrewBook, mismatchChapters) {
  const segments = new Map();

  for (const rawVerse of flattenBookVerses(englishBook)) {
    const markers = [...rawVerse.text.matchAll(JPS_MARKER_PATTERN)];
    const segmentCount = markers.length;
    const hasCrossChapterMarker = markers.some((marker) => Number(marker[1]) !== rawVerse.chapterNumber);
    const hebrewChapterCount = countChapterVerses(hebrewBook, rawVerse.chapterNumber);
    const englishChapterCount = countChapterVerses(englishBook, rawVerse.chapterNumber);
    const needsUnmarkedPsalmTitleShift =
      englishBook.id === "PSA" &&
      mismatchChapters.has(rawVerse.chapterNumber) &&
      segmentCount === 0 &&
      hebrewChapterCount === englishChapterCount + 1;
    const shouldUseMarkers =
      segmentCount > 0 && (mismatchChapters.has(rawVerse.chapterNumber) || hasCrossChapterMarker);

    if (needsUnmarkedPsalmTitleShift) {
      if (rawVerse.verseNumber === 1) {
        const split = splitUnmarkedPsalmTitle(rawVerse.text);
        if (!split) {
          throw new Error(`Unable to split unmarked JPS Psalm title in ${rawVerse.ref}`);
        }

        for (const [verseOffset, text] of [split.title, split.body].entries()) {
          const canonicalId = buildCanonicalId(
            englishBook.id,
            rawVerse.chapterNumber,
            rawVerse.verseNumber + verseOffset,
          );
          segments.set(canonicalId, [
            {
              text,
              originalRef: rawVerse.ref,
              originalDisplayRef: rawVerse.displayRef,
              alignmentAction: verseOffset === 0 ? "split" : "marker",
              alignmentQuality: "jps_title_split",
            },
          ]);
        }
      } else {
        const canonicalId = buildCanonicalId(
          englishBook.id,
          rawVerse.chapterNumber,
          rawVerse.verseNumber + 1,
        );
        segments.set(canonicalId, [
          {
            text: cleanJpsText(rawVerse.text),
            originalRef: rawVerse.ref,
            originalDisplayRef: rawVerse.displayRef,
            alignmentAction: "marker",
            alignmentQuality: "jps_title_split",
          },
        ]);
      }
      continue;
    }

    if (!shouldUseMarkers) {
      const canonicalId = buildCanonicalId(
        englishBook.id,
        rawVerse.chapterNumber,
        rawVerse.verseNumber,
      );
      segments.set(canonicalId, [
        {
          text: cleanJpsText(rawVerse.text),
          originalRef: rawVerse.ref,
        originalDisplayRef: rawVerse.displayRef,
        alignmentAction: "same",
        alignmentQuality: "exact",
        },
      ]);
      continue;
    }

    if (markers[0].index > 0) {
      const canonicalId = buildCanonicalId(
        englishBook.id,
        rawVerse.chapterNumber,
        rawVerse.verseNumber,
      );
      const existing = segments.get(canonicalId) ?? [];
      existing.push({
        text: cleanJpsText(rawVerse.text.slice(0, markers[0].index)),
        originalRef: rawVerse.ref,
        originalDisplayRef: rawVerse.displayRef,
        alignmentAction: "same",
        alignmentQuality: "exact",
      });
      segments.set(canonicalId, existing);
    }

    for (let index = 0; index < markers.length; index += 1) {
      const marker = markers[index];
      const targetChapter = Number(marker[1]);
      const targetVerse = Number(marker[2]);
      const textStart = marker.index + marker[0].length;
      const textEnd = markers[index + 1]?.index ?? rawVerse.text.length;
      const text = cleanJpsText(rawVerse.text.slice(textStart, textEnd));
      const canonicalId = buildCanonicalId(englishBook.id, targetChapter, targetVerse);
      const alignmentAction = getJpsAlignmentAction(
        rawVerse,
        targetChapter,
        targetVerse,
        segmentCount,
      );

      const existing = segments.get(canonicalId) ?? [];
      existing.push({
        text,
        originalRef: rawVerse.ref,
        originalDisplayRef: rawVerse.displayRef,
        alignmentAction,
        alignmentQuality: alignmentAction === "same" ? "exact" : "jps_mt_marker",
      });
      segments.set(canonicalId, existing);
    }
  }

  return segments;
}

function buildConformedBook({ hebrewBook, englishBook, sourceBookId }) {
  const canonicalVerses = flattenBookVerses(hebrewBook);
  const jpsSegments = buildJpsSegments(
    englishBook,
    hebrewBook,
    buildMismatchChapters(hebrewBook, englishBook),
  );
  const conformedVerses = [];
  const verseMapRows = [];

  for (const canonicalVerse of canonicalVerses) {
    const canonicalId = buildCanonicalId(
      sourceBookId,
      canonicalVerse.chapterNumber,
      canonicalVerse.verseNumber,
    );
    const jpsVerseSegments = jpsSegments.get(canonicalId);
    if (!jpsVerseSegments?.length) {
      throw new Error(`Missing JPS 1917 verse for ${canonicalId}`);
    }

    const englishText = cleanJpsText(jpsVerseSegments.map((segment) => segment.text).join(" "));
    const primarySegment = jpsVerseSegments[0];
    const reference = buildDisplayReference(
      englishBook.name,
      canonicalVerse.chapterNumber,
      canonicalVerse.verseNumber,
    );

    for (const segment of jpsVerseSegments) {
      verseMapRows.push({
        translation: "JPS1917",
        sourceRef: segment.originalRef,
        canonicalId,
        action: segment.alignmentAction,
        notes: segment.alignmentAction === "same"
          ? ""
          : "JPS embedded MT marker used to attach English text to the OSHB/MT verse grid.",
      });
    }

    conformedVerses.push({
      canonicalId,
      verseNumber: canonicalVerse.verseNumber,
      reference,
      hebrewText: canonicalVerse.text,
      englishText,
      translation: "JPS 1917",
      translations: {
        jps: {
          text: englishText,
          originalRef: primarySegment.originalRef,
          originalDisplayRef: primarySegment.originalDisplayRef,
          displayRef: reference,
          alignmentQuality: primarySegment.alignmentQuality,
          alignmentAction: primarySegment.alignmentAction,
        },
      },
    });
  }

  return {
    canonicalVerses,
    conformedVerses,
    verseMapRows,
  };
}

function validateTanakh(tanakh) {
  const canonicalIds = new Set();
  const issues = [];
  let chapterCount = 0;
  let verseCount = 0;

  for (const book of tanakh.books) {
    chapterCount += book.chapters.length;
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        verseCount += 1;
        if (!verse.canonicalId) {
          issues.push(`Missing canonical_id for ${book.sourceId} ${chapter.chapterNumber}:${verse.verseNumber}`);
        }
        if (canonicalIds.has(verse.canonicalId)) {
          issues.push(`Duplicate canonical_id ${verse.canonicalId}`);
        }
        canonicalIds.add(verse.canonicalId);
        if (!verse.hebrewText) {
          issues.push(`Missing Hebrew text for ${verse.canonicalId}`);
        }
        if (!verse.translations?.jps?.text || !verse.englishText) {
          issues.push(`Missing JPS 1917 text for ${verse.canonicalId}`);
        }
        if (verse.reference.includes("Malachi 4")) {
          issues.push(`Malachi 4 leaked into display reference ${verse.reference}`);
        }
      }
    }
  }

  if (tanakh.bookCount !== EXPECTED_COUNTS.books) {
    issues.push(`Expected ${EXPECTED_COUNTS.books} books, got ${tanakh.bookCount}`);
  }
  if (chapterCount !== EXPECTED_COUNTS.chapters || tanakh.chapterCount !== EXPECTED_COUNTS.chapters) {
    issues.push(`Expected ${EXPECTED_COUNTS.chapters} chapters, got ${tanakh.chapterCount}/${chapterCount}`);
  }
  if (verseCount !== EXPECTED_COUNTS.verses || tanakh.verseCount !== EXPECTED_COUNTS.verses) {
    issues.push(`Expected ${EXPECTED_COUNTS.verses} verses, got ${tanakh.verseCount}/${verseCount}`);
  }

  const malachi = tanakh.books.find((book) => book.sourceId === "MAL");
  const malachiThree = malachi?.chapters.find((chapter) => chapter.chapterNumber === 3);
  const malachiLast = malachiThree?.verses.find((verse) => verse.verseNumber === 24);
  if (malachi?.chapters.length !== 3 || !malachiLast) {
    issues.push("Malachi must be conformed to 3 OSHB chapters with Malachi 3:24 present.");
  } else if (malachiLast.translations.jps.originalRef !== "MAL.004.006") {
    issues.push(`Expected Malachi 3:24 to map from MAL.004.006, got ${malachiLast.translations.jps.originalRef}`);
  }

  const psalmFive = tanakh.books
    .find((book) => book.sourceId === "PSA")
    ?.chapters.find((chapter) => chapter.chapterNumber === 5);
  const psalmTitle = psalmFive?.verses.find((verse) => verse.verseNumber === 1);
  const psalmBody = psalmFive?.verses.find((verse) => verse.verseNumber === 2);
  if (!psalmTitle?.englishText.includes("For the Leader; upon the Nehiloth")) {
    issues.push("Psalm 5:1 must contain the JPS superscription.");
  }
  if (!psalmBody?.englishText.startsWith("Give ear to my words")) {
    issues.push("Psalm 5:2 must contain the JPS Psalm 5 body text.");
  }

  if (issues.length > 0) {
    throw new Error(`Tanakh import validation failed:\n${issues.join("\n")}`);
  }
}

function buildTanakh(hebrew, english) {
  const hebrewBooks = bookById(hebrew);
  const englishBooks = bookById(english);
  const books = [];
  const verseMapRows = [];
  let sortOrder = 0;

  for (const sourceBookId of TANAKH_BOOK_IDS) {
    const hebrewBook = hebrewBooks.get(sourceBookId);
    const englishBook = englishBooks.get(sourceBookId);
    if (!hebrewBook || !englishBook) {
      throw new Error(`Missing source book ${sourceBookId}`);
    }

    const { conformedVerses, verseMapRows: bookVerseMapRows } = buildConformedBook({
      hebrewBook,
      englishBook,
      sourceBookId,
    });
    const chapters = [];

    for (const chapterEntry of hebrewBook.chapters) {
      const chapterNumber = chapterEntry.chapter.number;
      const verses = conformedVerses
        .filter((verse) => verse.canonicalId.startsWith(`${sourceBookId}.${padNumber(chapterNumber)}.`))
        .map((verse) => {
          sortOrder += 1;
          return {
            ...verse,
            sortOrder,
          };
        });

      chapters.push({
        chapterNumber,
        verses,
      });
    }

    books.push({
      id: LOCAL_BOOK_IDS[sourceBookId],
      sourceId: sourceBookId,
      nameEnglish: englishBook.name,
      nameHebrew: hebrewBook.name,
      chapterCount: chapters.length,
      verseCount: chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0),
      chapters,
    });
    verseMapRows.push(...bookVerseMapRows);
  }

  const tanakh = {
    generatedAt: new Date().toISOString(),
    translation: "JPS 1917",
    hebrewSource: "HBOMAS",
    versification: "OSHB/MT",
    bookCount: books.length,
    chapterCount: books.reduce((sum, book) => sum + book.chapters.length, 0),
    verseCount: books.reduce((sum, book) => sum + book.verseCount, 0),
    alignmentWarnings: [],
    alignmentSummary: {
      exact: verseMapRows.filter((row) => row.action === "same").length,
      markerBased: verseMapRows.filter((row) => row.action === "marker").length,
      split: verseMapRows.filter((row) => row.action === "split").length,
      movedChapter: verseMapRows.filter((row) => row.action === "move_chapter").length,
    },
    verseMap: verseMapRows,
    books,
  };

  validateTanakh(tanakh);
  return tanakh;
}

async function main() {
  const [hebrew, english] = await Promise.all([
    fetchJson("/api/HBOMAS/complete.json"),
    fetchJson("/api/eng_jps/complete.json"),
  ]);

  const tanakh = buildTanakh(hebrew, english);
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(tanakh)}\n`);
  await fs.writeFile(
    SOURCES_PATH,
    `${JSON.stringify(
      {
        sources: [
          {
            id: "HBOMAS",
            name: hebrew.translation.englishName,
            website: hebrew.translation.website,
            licenseUrl: hebrew.translation.licenseUrl,
          },
          {
            id: "eng_jps",
            name: english.translation.name,
            website: english.translation.website,
            licenseUrl: english.translation.licenseUrl,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Imported ${tanakh.bookCount} books, ${tanakh.chapterCount} chapters, ${tanakh.verseCount} verses.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
