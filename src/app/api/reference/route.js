import { parseReference } from "@/lib/reference/parser";

export function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference") ?? "";
  const parsed = parseReference(reference);

  if (!parsed.ok) {
    return Response.json(parsed, { status: 400 });
  }

  return Response.json(parsed);
}
