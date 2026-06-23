import { TANAKH_BOOKS } from "@/lib/reference/books";
import { parseReference } from "@/lib/reference/parser";
import {
  discoverOpenAiReferences,
  hasOpenAiReferenceProvider,
} from "@/lib/search/openai-reference-provider";
import searchIndexData from "@/data/search-index.json";
import tanakh from "@/data/tanakh.json";

const MAX_RESULTS = 8;
const MIN_LOCAL_CONFIDENCE_TO_SKIP_AI = 0.65;
const MIN_RESULT_CONFIDENCE = 0.55;
const MIN_DEBUG_RESULT_CONFIDENCE = 0.24;
const MIN_STRONG_RESULT_CONFIDENCE = 0.75;
const MIN_CONFIDENCE_NEAR_STRONG_RESULT = 0.2;
const MIN_AI_ALIGNMENT_SCORE = 0.36;
const MIN_AI_ALIGNMENT_IMPROVEMENT = 0.18;
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
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "no",
  "not",
  "of",
  "on",
  "or",
  "shall",
  "say",
  "says",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "unto",
  "where",
  "will",
  "with",
  "you",
]);

const TOKEN_SYNONYMS = new Map([
  ["instruction", ["law", "torah"]],
  ["law", ["instruction", "torah"]],
  ["torah", ["instruction", "law"]],
]);

let searchIndex = null;

export async function searchScripture(query, options = {}) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return {
      results: [],
      sources: { direct: false, local: false, ai: false },
      onlineSearchAvailable: hasOpenAiReferenceProvider(),
    };
  }

  const directResults = getDirectReferenceResults(normalizedQuery);
  if (directResults.length > 0) {
    return {
      results: directResults.slice(0, MAX_RESULTS),
      sources: { direct: true, local: false, ai: false },
      onlineSearchAvailable: hasOpenAiReferenceProvider(),
    };
  }

  const localResults = searchLocalText(normalizedQuery);
  const shouldUseAi = shouldUseAiDiscovery(localResults);
  const aiDiscovery = shouldUseAi && !options.disableAi
    ? await discoverAiReferences(normalizedQuery)
    : { results: [], error: null };
  const aiResults = aiDiscovery.results;

  const results = filterRankedResults(mergeResults([...localResults, ...aiResults])).slice(
    0,
    MAX_RESULTS,
  );

  const payload = {
    results,
    sources: {
      direct: directResults.length > 0,
      local: localResults.length > 0,
      ai: aiResults.length > 0,
    },
    onlineSearchAvailable: hasOpenAiReferenceProvider(),
  };

  if (shouldIncludeSearchDebug(options) && aiDiscovery.error) {
    payload.debug = {
      ai: {
        error: serializeAiDiscoveryError(aiDiscovery.error),
      },
    };
  }

  return payload;
}

export function getDirectReferenceResults(query) {
  const candidates = getReferenceCandidates(query);
  return candidates
    .map((candidate) =>
      validateReferenceResult({
        reference: candidate,
        confidence: 1,
        source: "direct",
        reason: "Direct reference match",
      }),
    )
    .filter(Boolean);
}

export function searchLocalText(query) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenize(query);
  const queryTokenGroups = queryTokens.map((token) => [token, ...(TOKEN_SYNONYMS.get(token) ?? [])]);
  if (!normalizedQuery || queryTokens.length === 0) {
    return [];
  }

  const index = getSearchIndex();
  const candidates = new Set();
  for (const tokens of queryTokenGroups) {
    for (const token of tokens) {
      for (const entry of index.byToken.get(token) ?? []) {
        candidates.add(entry);
      }
    }
  }

  return [...candidates]
    .map((entry) => ({
      entry,
      score: scoreVerse(entry, normalizedQuery, queryTokenGroups),
    }))
    .filter(({ score }) => score >= MIN_DEBUG_RESULT_CONFIDENCE)
    .sort((a, b) => b.score - a.score || a.entry.sortOrder - b.entry.sortOrder)
    .slice(0, MAX_RESULTS)
    .map(({ entry, score }) =>
      validateReferenceResult({
        reference: entry.reference,
        confidence: score,
        source: "local",
        reason: "Matched verified local scripture text",
      }),
    )
    .filter(Boolean);
}

export function shouldUseAiDiscovery(localResults) {
  const bestLocalConfidence = localResults[0]?.confidence ?? 0;

  // A strong local hit is already backed by verified text, so avoid making users wait on AI.
  return localResults.length === 0 || bestLocalConfidence < MIN_LOCAL_CONFIDENCE_TO_SKIP_AI;
}

export function filterRankedResults(results) {
  const bestConfidence = results[0]?.confidence ?? 0;
  const minimumConfidence =
    bestConfidence >= MIN_STRONG_RESULT_CONFIDENCE
      ? Math.max(MIN_RESULT_CONFIDENCE, bestConfidence - MIN_CONFIDENCE_NEAR_STRONG_RESULT)
      : MIN_DEBUG_RESULT_CONFIDENCE;

  return results.filter((result) => result.confidence >= minimumConfidence);
}

export function validateReferenceResult(candidate) {
  const parsed = parseReference(candidate.reference ?? "");
  if (!parsed.ok) {
    return null;
  }

  const { bookId, bookName, chapter, verseStart, verseEnd } = parsed.reference;
  const book = tanakh.books.find((entry) => entry.id === bookId);
  const chapterEntry = book?.chapters.find((entry) => entry.chapterNumber === chapter);
  if (!chapterEntry) {
    return null;
  }

  const firstVerse = chapterEntry.verses[0]?.verseNumber ?? null;
  const lastVerse = chapterEntry.verses.at(-1)?.verseNumber ?? null;
  const isChapterOnly = verseStart == null && verseEnd == null;
  const normalizedVerseStart = isChapterOnly ? firstVerse : verseStart;
  const normalizedVerseEnd = isChapterOnly ? lastVerse : verseEnd ?? normalizedVerseStart;

  if (
    !Number.isInteger(normalizedVerseStart) ||
    !Number.isInteger(normalizedVerseEnd) ||
    normalizedVerseStart < firstVerse ||
    normalizedVerseEnd > lastVerse
  ) {
    return null;
  }

  const reference =
    normalizedVerseStart === normalizedVerseEnd
      ? `${bookName} ${chapter}:${normalizedVerseStart}`
      : `${bookName} ${chapter}:${normalizedVerseStart}-${normalizedVerseEnd}`;

  return {
    reference,
    bookId,
    chapter,
    verseStart: normalizedVerseStart,
    verseEnd: normalizedVerseEnd,
    confidence: clampConfidence(candidate.confidence),
    source: candidate.source ?? "local",
    reason: getResultReason(candidate),
  };
}

export function mergeResults(results) {
  const byRange = new Map();

  for (const result of results) {
    if (!result) {
      continue;
    }

    const key = `${result.bookId}.${result.chapter}.${result.verseStart}.${result.verseEnd}`;
    const existing = byRange.get(key);
    if (!existing || result.confidence > existing.confidence) {
      byRange.set(key, result);
    }
  }

  return [...byRange.values()].sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }

    const bookA = TANAKH_BOOKS.find((book) => book.id === a.bookId)?.canonicalOrder ?? 999;
    const bookB = TANAKH_BOOKS.find((book) => book.id === b.bookId)?.canonicalOrder ?? 999;
    return bookA - bookB || a.chapter - b.chapter || a.verseStart - b.verseStart;
  });
}

async function discoverAiReferences(query) {
  if (!hasOpenAiReferenceProvider()) {
    return { results: [], error: null };
  }

  try {
    // AI is allowed to propose references only; validation below is the trust boundary.
    const results = (await discoverOpenAiReferences(query))
      .map((result) =>
        validateAndAlignAiReferenceResult(result, query),
      )
      .filter(Boolean);

    return { results, error: null };
  } catch (error) {
    return { results: [], error };
  }
}

function validateAndAlignAiReferenceResult(result, query) {
  const validated = validateReferenceResult({
    reference: result.reference,
    confidence: Math.min(result.confidence, 0.86),
    source: "ai",
    reason: "AI-proposed reference validated against local scripture data",
  });

  if (!validated || validated.verseStart !== validated.verseEnd) {
    return validated;
  }

  return alignAiSingleVerseResult(validated, query);
}

function alignAiSingleVerseResult(result, query) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokenGroups = tokenize(query).map((token) => [token, ...(TOKEN_SYNONYMS.get(token) ?? [])]);
  if (!normalizedQuery || queryTokenGroups.length === 0) {
    return result;
  }

  const candidates = getAdjacentVerseEntries(result)
    .map((entry) => ({
      entry,
      score: scoreVerse(entry, normalizedQuery, queryTokenGroups),
    }))
    .sort((a, b) => b.score - a.score);

  const proposed = candidates.find((candidate) => candidate.entry.verse === result.verseStart);
  const best = candidates[0];
  if (
    !best ||
    best.entry === proposed?.entry ||
    best.score < MIN_AI_ALIGNMENT_SCORE ||
    best.score < (proposed?.score ?? 0) + MIN_AI_ALIGNMENT_IMPROVEMENT
  ) {
    return result;
  }

  return validateReferenceResult({
    reference: best.entry.reference,
    confidence: result.confidence,
    source: "ai",
    reason: "AI-proposed reference aligned against local scripture data",
  });
}

function getAdjacentVerseEntries(result) {
  const entries = getSearchIndex().entries;
  const proposedIndex = entries.findIndex(
    (entry) =>
      entry.bookId === result.bookId &&
      entry.chapter === result.chapter &&
      entry.verse === result.verseStart,
  );

  if (proposedIndex < 0) {
    return [];
  }

  return entries
    .slice(Math.max(0, proposedIndex - 1), proposedIndex + 2)
    .filter((entry) => entry.bookId === result.bookId && entry.chapter === result.chapter);
}

function shouldIncludeSearchDebug(options) {
  return options.debug || process.env.SEARCH_DEBUG === "true" || process.env.NODE_ENV !== "production";
}

function serializeAiDiscoveryError(error) {
  if (error?.name === "AbortError") {
    return {
      provider: "openai",
      name: "AbortError",
      message: "OpenAI reference discovery timed out.",
    };
  }

  return {
    provider: "openai",
    name: error?.name ?? "Error",
    status: error?.status ?? null,
    code: error?.code ?? null,
    type: error?.type ?? null,
    message: error?.message ?? "OpenAI reference discovery failed.",
  };
}

function getSearchIndex() {
  if (searchIndex) {
    return searchIndex;
  }

  const entries = searchIndexData.entries;
  const byToken = new Map();

  for (const [token, indexes] of Object.entries(searchIndexData.byToken)) {
    byToken.set(
      token,
      indexes.map((index) => entries[index]),
    );
  }

  searchIndex = { entries, byToken };

  return searchIndex;
}

function getReferenceCandidates(query) {
  const candidates = new Set();
  const normalized = query.trim().replace(/\s+/g, " ");

  if (parseReference(normalized).ok) {
    candidates.add(normalized);
  }

  for (const book of TANAKH_BOOKS) {
    const names = [book.nameEnglish, ...book.aliases].sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (isAmbiguousEmbeddedAlias(name)) {
        continue;
      }

      const escapedName = escapeRegExp(name);
      const pattern = new RegExp(`\\b${escapedName}\\.?\\s+\\d{1,3}(?::\\d{1,3}(?:-\\d{1,3})?)?\\b`, "gi");
      for (const match of normalized.matchAll(pattern)) {
        candidates.add(match[0]);
      }
    }
  }

  return [...candidates];
}

function isAmbiguousEmbeddedAlias(name) {
  return name.replace(/[^a-z0-9]/gi, "").length < 3;
}

function getResultReason(candidate) {
  if (candidate.source === "ai") {
    return "AI-proposed reference validated against local scripture data";
  }

  return candidate.reason ?? "";
}

function scoreVerse(entry, normalizedQuery, queryTokenGroups) {
  if (entry.english.includes(normalizedQuery) || entry.hebrew.includes(normalizedQuery)) {
    return 0.94;
  }

  const entryTokenSet = new Set(entry.tokens);
  const matchedTokenGroups = queryTokenGroups.filter((tokens) =>
    tokens.some((token) => entryTokenSet.has(token)),
  );
  const overlap = matchedTokenGroups.length / queryTokenGroups.length;
  const rareBonus = matchedTokenGroups.some((tokens) => tokens.some((token) => token.length >= 7))
    ? 0.08
    : 0;

  return Math.min(0.9, overlap * 0.72 + rareBonus);
}

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
    .replace(/[\u05be\u05c0\u05c3\u05f3\u05f4]/g, " ")
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, confidence));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
