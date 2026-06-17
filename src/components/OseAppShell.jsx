"use client";

import { BookOpenText, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TANAKH_BOOKS } from "@/lib/reference/books";
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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
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

    if (syncReaderUrl) {
      window.history.replaceState(null, "", `/read/${bookId}/${chapter}`);
    }
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
            <SearchTab query={query} setQuery={setQuery} />
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

function SearchTab({ query, setQuery }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Search Scripture</h2>
        <p className="mt-1 text-sm text-zinc-600">
          AI search is planned for Part 2. Part 1 is focused on the offline reader.
        </p>
      </div>

      <form className="space-y-3">
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
          disabled
          type="button"
        >
          Search
        </button>
      </form>

      <section className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-5">
        <h3 className="text-sm font-semibold">Next vertical slice</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Future search will find Scripture references online, validate them, and
          open the matching reader location.
        </p>
      </section>
    </div>
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
