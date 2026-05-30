import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getSettingsRepo } from "@/db/repository";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/assistant/chat/projects");

/**
 * GET /api/chat/projects — return project slugs available for @mention in the chat composer.
 */
export async function handleGetChatProjects() {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  try {
    const repo = getSettingsRepo();
    const contextMap = await repo.getProjectContextMap().catch(() => ({}));
    const slugs = Object.keys(contextMap);
    return NextResponse.json(slugs);
  } catch (error) {
    log.error("Failed to load assistant chat projects", { error });
    return NextResponse.json([]);
  }
}
