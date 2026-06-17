import OseAppShell from "@/components/OseAppShell";
import { TANAKH_BOOKS } from "@/lib/reference/books";
import { notFound } from "next/navigation";

export const dynamicParams = false;

export function generateStaticParams() {
  return TANAKH_BOOKS.flatMap((book) =>
    Array.from({ length: book.chapters }, (_, index) => ({
      book: book.id,
      chapter: String(index + 1),
    })),
  );
}

export default async function ReadChapterPage({ params }) {
  const { book, chapter } = await params;
  const chapterNumber = Number(chapter);
  const bookMeta = TANAKH_BOOKS.find((candidate) => candidate.id === book);

  if (!bookMeta || !Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > bookMeta.chapters) {
    notFound();
  }

  return (
    <OseAppShell
      initialTab="bible"
      initialBookId={book}
      initialChapter={chapterNumber}
      syncReaderUrl
    />
  );
}
