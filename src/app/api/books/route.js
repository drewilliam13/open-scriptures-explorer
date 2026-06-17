import { getTanakhSummary } from "@/lib/scripture/repository";

export function GET() {
  return Response.json(getTanakhSummary());
}
