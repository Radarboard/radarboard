import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getLlmRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";
import { buildKnowledgeHealthItems } from "@/lib/knowledge-health";

const log = createLogger("api/assistant/knowledge-health/items");

const querySchema = z.object({
  project: z.string().optional(),
  type: z.enum(["all", "memory", "artifact"]).optional(),
  stale: z.enum(["all", "true", "false"]).optional(),
  feedback: z.enum(["all", "positive", "negative", "mixed", "any"]).optional(),
  evidence: z.enum(["all", "present", "none"]).optional(),
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function parseStale(value: string | undefined): boolean | "all" {
  if (value === "true") return true;
  if (value === "false") return false;
  return "all";
}

export async function handleGetKnowledgeHealthItems(request: Request) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return errorJson(400, "Invalid query parameters");
    }

    const repo = getLlmRepo();
    return NextResponse.json(
      await buildKnowledgeHealthItems(repo, {
        project: parsed.data.project ?? null,
        type: parsed.data.type,
        stale: parseStale(parsed.data.stale),
        feedback: parsed.data.feedback,
        evidence: parsed.data.evidence,
        query: parsed.data.query ?? null,
        page: parsed.data.page,
        limit: parsed.data.limit,
      })
    );
  } catch (err) {
    log.error("Failed to load knowledge health items", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
