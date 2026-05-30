import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getLlmRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";
import { buildKnowledgeHealthProject } from "@/lib/knowledge-health";

const log = createLogger("api/assistant/knowledge-health/project");

export async function handleGetKnowledgeHealthProject(slug: string) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  try {
    const repo = getLlmRepo();
    return NextResponse.json(await buildKnowledgeHealthProject(repo, slug));
  } catch (err) {
    log.error("Failed to load knowledge health project", { error: err });
    return errorJson(500, err instanceof Error ? err.message : String(err));
  }
}
