import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getLlmRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";
import { buildKnowledgeHealthItemDetail } from "@/lib/knowledge-health";

const log = createLogger("api/assistant/knowledge-health/item");

export async function handleGetKnowledgeHealthItemDetail(id: string) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  try {
    const repo = getLlmRepo();
    const item = await buildKnowledgeHealthItemDetail(repo, id);
    if (!item) {
      return errorJson(404, "Item not found");
    }
    return NextResponse.json({ item });
  } catch (err) {
    log.error("Failed to load knowledge health item", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
