import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { handleRoute, parseSearchParams } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const conversationSearchSchema = z.object({
  q: z.string().optional(),
  limit: z.string().optional(),
});

export async function handleSearchConversationMessages(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  return handleRoute(
    async () => {
      const parsed = parseSearchParams(new URL(request.url).searchParams, conversationSearchSchema);
      if (!parsed.ok) return parsed.response;
      const query = parsed.data.q?.trim() ?? "";
      const limit = Math.min(Number(parsed.data.limit ?? "20"), 50);

      if (!query) {
        return NextResponse.json([]);
      }

      const repo = getLlmRepo();
      const results = await repo.searchMessages(query, limit);
      return NextResponse.json(results);
    },
    { context: "Search failed" }
  );
}
