"use client";

import { BookOpenText, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TANAKH_BOOKS } from "@/lib/reference/books";
import { clearSearchHistory, listSearchHistory, saveSearchHistory } from "@/lib/search/history";
import { getStaticChapterPayload } from "@/lib/scripture/static-client";

const STORAGE_KEY = "ose.activeTab";

export default function OseAppShell({
  initialTab = "bible",
  initialBookId = "gen",
  initialChapter = 1,
  syncReaderUrl = false,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [selectedBookId, setSelectedBookId] = useState(initialBookId);
  const [selectedChapter, setSelectedChapter] = useState(initialChapter);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      window.caches?.keys().then((keys) => {
        keys.filter((key) => key.startsWith("ose-")).forEach((key) => window.caches.delete(key));
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (initialTab === "bible") {
      window.localStorage.setItem(STORAGE_KEY, "bible");
      return;
    }

    const storedTab = window.localStorage.getItem(STORAGE_KEY);
    if (storedTab === "search" || storedTab === "bible") {
      setActiveTab(storedTab);
    }
  }, [initialTab]);

  function selectReaderLocation(bookId, chapter) {
    setSelectedBookId(bookId);
    setSelectedChapter(chapter);

    if (syncReaderUrl || window.location.pathname.startsWith("/read/")) {
      window.history.replaceState(null, "", `/read/${bookId}/${chapter}`);
    }
  }

  function openSearchResult(result) {
    setSelectedBookId(result.bookId);
    setSelectedChapter(result.chapter);
    setActiveTab("bible");
    window.localStorage.setItem(STORAGE_KEY, "bible");
    window.history.pushState(null, "", `/read/${result.bookId}/${result.chapter}`);
  }

  function selectTab(tab) {
    setActiveTab(tab);
    window.localStorage.setItem(STORAGE_KEY, tab);

    if (syncReaderUrl && tab === "search") {
      window.history.replaceState(null, "", "/");
    }
  }

  const selectedBookMeta = useMemo(
    () => TANAKH_BOOKS.find((book) => book.id === selectedBookId),
    [selectedBookId],
  );

  return (
    <main className="min-h-dvh bg-stone-50 text-zinc-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
        <header className="border-b border-zinc-200 bg-white px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-700">
            Open Scripture Explorer
          </p>
          <h1 className="mt-1 text-xl font-semibold">Hebrew-first Tanakh reader</h1>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-28">
          {activeTab === "search" ? (
            <SearchTab query={query} setQuery={setQuery} onOpenResult={openSearchResult} />
          ) : (
            <BibleTab
              selectedBookId={selectedBookId}
              selectedChapter={selectedChapter}
              selectedBookMeta={selectedBookMeta}
              selectReaderLocation={selectReaderLocation}
            />
          )}
        </section>

        <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2">
            <TabButton
              active={activeTab === "search"}
              icon={Search}
              label="Search"
              onClick={() => selectTab("search")}
            />
            <TabButton
              active={activeTab === "bible"}
              icon={BookOpenText}
              label="Bible"
              onClick={() => selectTab("bible")}
            />
          </div>
        </nav>
      </div>
    </main>
  );
}

function SearchTab({ query, setQuery, onOpenResult }) {
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    refreshHistory();
  }, []);

  async function refreshHistory() {
    try {
      setHistory(await listSearchHistory());
    } catch {
      setHistory([]);
    }
  }

  async function submitSearch(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2 || status === "loading") {
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed.");
      }

      setResults(payload.results ?? []);
      setSearchMeta({
        sources: payload.sources,
        onlineSearchAvailable: payload.onlineSearchAvailable,
      });
      setStatus("ready");
      void persistSearchHistory(trimmedQuery);
    } catch (searchError) {
      setResults([]);
      setSearchMeta(null);
      setError(searchError.message);
      setStatus("error");
    }
  }

  async function persistSearchHistory(trimmedQuery) {
    try {
      await saveSearchHistory(trimmedQuery);
      await refreshHistory();
    } catch {
      // History is local-only convenience state; search results should not depend on IndexedDB.
    }
  }

  async function clearHistory() {
    await clearSearchHistory();
    setHistory([]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Search Scripture</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Find Tanakh references from direct citations, remembered wording, or paraphrases.
        </p>
      </div>

      <form className="space-y-3" onSubmit={submitSearch}>
        <label className="block text-sm font-medium" htmlFor="scripture-search">
          Natural language search
        </label>
        <textarea
          className="min-h-28 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base outline-none ring-teal-600 transition focus:ring-2"
          id="scripture-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="where does God carry Israel on eagle wings"
          value={query}
        />
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={query.trim().length < 2 || status === "loading"}
          type="submit"
        >
          {status === "loading" ? "Searching..." : "Search"}
        </button>
      </form>

      {searchMeta ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
          Results quote only the verified local OSHB + JPS collection.
          {searchMeta.onlineSearchAvailable ? " Online AI discovery is available." : " Add OPENAI_API_KEY to enable online AI discovery."}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {results.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Results</h3>
          {results.map((result) => (
            <SearchResultCard
              key={`${result.bookId}-${result.chapter}-${result.verseStart}-${result.verseEnd}`}
              result={result}
              onOpen={() => onOpenResult(result)}
            />
          ))}
        </section>
      ) : status === "ready" ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-600">
          No verified local references found.
        </p>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Recent searches</h3>
            <button
              className="text-sm font-medium text-teal-700"
              onClick={clearHistory}
              type="button"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((entry) => (
              <button
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700"
                key={entry.id}
                onClick={() => setQuery(entry.query)}
                type="button"
              >
                {entry.query}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SearchResultCard({ result, onOpen }) {
  const [preview, setPreview] = useState([]);

  useEffect(() => {
    let isActive = true;

    async function loadPreview() {
      try {
        const chapter = await getStaticChapterPayload(result.bookId, result.chapter);
        if (!isActive) {
          return;
        }

        setPreview(
          chapter?.verses.filter(
            (verse) => verse.verseNumber >= result.verseStart && verse.verseNumber <= result.verseEnd,
          ) ?? [],
        );
      } catch {
        if (isActive) {
          setPreview([]);
        }
      }
    }

    loadPreview();

    return () => {
      isActive = false;
    };
  }, [result]);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">{result.reference}</h4>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">
            {result.source} · {Math.round(result.confidence * 100)}%
          </p>
        </div>
        <button
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
          onClick={onOpen}
          type="button"
        >
          Open
        </button>
      </div>

      {preview.length > 0 ? (
        <div className="mt-3 space-y-3">
          {preview.map((verse) => (
            <div className="space-y-1" key={verse.reference}>
              <p className="text-right text-xl leading-8" dir="rtl" lang="he">
                {verse.hebrewText}
              </p>
              <p className="text-sm leading-6 text-zinc-600">{verse.englishText}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">Loading verified local text...</p>
      )}
    </article>
  );
}

function BibleTab({
  selectedBookId,
  selectedChapter,
  selectedBookMeta,
  selectReaderLocation,
}) {
  const [chapter, setChapter] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let isActive = true;

    async function loadChapter() {
      setStatus("loading");
      try {
        const payload = await getStaticChapterPayload(selectedBookId, selectedChapter);

        if (!isActive) {
          return;
        }

        if (!payload) {
          setChapter(null);
          setStatus("missing");
          return;
        }

        setChapter(payload);
        setStatus("ready");
      } catch {
        if (isActive) {
          setChapter(null);
          setStatus("error");
        }
      }
    }

    loadChapter();

    return () => {
      isActive = false;
    };
  }, [selectedBookId, selectedChapter]);

  const availableBooks = TANAKH_BOOKS;
  const availableChapters = Array.from(
    { length: selectedBookMeta?.chapters ?? 1 },
    (_, index) => index + 1,
  );
  const selectedBookIndex = TANAKH_BOOKS.findIndex((book) => book.id === selectedBookId);
  const previousLocation =
    selectedChapter > 1
      ? { bookId: selectedBookId, chapter: selectedChapter - 1 }
      : selectedBookIndex > 0
        ? {
            bookId: TANAKH_BOOKS[selectedBookIndex - 1].id,
            chapter: TANAKH_BOOKS[selectedBookIndex - 1].chapters,
          }
        : null;
  const nextLocation =
    selectedBookMeta && selectedChapter < selectedBookMeta.chapters
      ? { bookId: selectedBookId, chapter: selectedChapter + 1 }
      : selectedBookIndex >= 0 && selectedBookIndex < TANAKH_BOOKS.length - 1
        ? { bookId: TANAKH_BOOKS[selectedBookIndex + 1].id, chapter: 1 }
        : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Bible Reader</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Browse the full Tanakh on the OSHB/MT verse grid with Hebrew first and JPS second.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="book-select">
            Tanakh book
          </label>
          <select
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none ring-teal-600 transition focus:ring-2"
            id="book-select"
            onChange={(event) => {
              const nextBookId = event.target.value;
              const nextBook = TANAKH_BOOKS.find((book) => book.id === nextBookId);
              selectReaderLocation(
                nextBookId,
                Math.min(selectedChapter, nextBook?.chapters ?? 1),
              );
            }}
            value={selectedBookId}
          >
            {availableBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.nameEnglish}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="chapter-select">
            Chapter
          </label>
          <select
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none ring-teal-600 transition focus:ring-2"
            id="chapter-select"
            onChange={(event) => selectReaderLocation(selectedBookId, Number(event.target.value))}
            value={selectedChapter}
          >
            {availableChapters.map((chapterNumber) => (
              <option key={chapterNumber} value={chapterNumber}>
                {chapterNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      <article className="rounded-lg border border-zinc-200 bg-white px-4 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-700">
              {selectedBookMeta?.section}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{selectedBookMeta?.nameEnglish}</h3>
          </div>
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
            Chapter {selectedChapter}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
            disabled={!previousLocation}
            onClick={() => {
              if (previousLocation) {
                selectReaderLocation(previousLocation.bookId, previousLocation.chapter);
              }
            }}
            type="button"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
            disabled={!nextLocation}
            onClick={() => {
              if (nextLocation) {
                selectReaderLocation(nextLocation.bookId, nextLocation.chapter);
              }
            }}
            type="button"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>

        {status === "loading" ? <p className="mt-6 text-sm text-zinc-600">Loading chapter...</p> : null}
        {status === "missing" ? (
          <p className="mt-6 text-sm text-zinc-600">
            This chapter is not available in the OSHB/MT verse grid.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="mt-6 text-sm text-zinc-600">
            The chapter could not be loaded.
          </p>
        ) : null}

        {chapter ? (
          <div className="mt-6 space-y-4">
            {chapter.verses.map((verse) => (
              <div key={verse.reference} className="space-y-2 border-b border-zinc-100 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-teal-700">{verse.reference}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Verse {verse.verseNumber}
                  </span>
                </div>
                <p className="text-right text-2xl leading-10" dir="rtl" lang="he">
                  {verse.hebrewText}
                </p>
                <p className="text-sm leading-6 text-zinc-600">{verse.englishText}</p>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      aria-pressed={active}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
        active
          ? "bg-teal-700 text-white"
          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
      {label}
    </button>
  );
}
