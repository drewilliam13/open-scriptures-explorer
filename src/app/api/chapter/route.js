import { getChapterPayload } from "@/lib/scripture/repository";

export function GET(request) {
  const { searchParams } = new URL(request.url);
  const book = searchParams.get("book") ?? "";
  const chapter = searchParams.get("chapter") ?? "";

  const result = getChapterPayload(book, chapter);
  if (!result.ok) {
    return Response.json(result, { status: result.status });
  }

  return Response.json(result);
}
