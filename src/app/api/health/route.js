import { hasOpenAiReferenceProvider } from "@/lib/search/openai-reference-provider";
import { getSearchRateLimitConfig } from "@/lib/rate-limit";
import { getTanakhSummary } from "@/lib/scripture/repository";

export function GET() {
  const summary = getTanakhSummary();

  return Response.json({
    status: "ok",
    app: "Open Scripture Explorer",
    generatedAt: summary.generatedAt,
    scripture: {
      bookCount: summary.bookCount,
      chapterCount: summary.chapterCount,
      verseCount: summary.verseCount,
      alignmentWarningCount: summary.alignmentWarningCount,
    },
    search: {
      aiConfigured: hasOpenAiReferenceProvider(),
      rateLimit: getSearchRateLimitConfig(),
    },
  });
}
