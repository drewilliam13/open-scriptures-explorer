import { TANAKH_BOOKS } from "@/lib/reference/books";

export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://open-scripture-explorer.vercel.app";

  return [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...TANAKH_BOOKS.flatMap((book) =>
      Array.from({ length: book.chapters }, (_, index) => ({
        url: `${baseUrl}/read/${book.id}/${index + 1}`,
        changeFrequency: "yearly",
        priority: 0.7,
      })),
    ),
  ];
}
