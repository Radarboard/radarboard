import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { getFeatureServerRoute } from "@/lib/extensions/runtime/server/feature-server";

const log = createLogger("api/briefing");

/** GET /api/briefing — returns cached briefing or generates a new one. */
export async function handleGetBriefing() {
  try {
    const route = getFeatureServerRoute("briefing", "briefing");
    if (!route) return errorJson(404, "Briefing feature route is not registered");

    const result = await route({
      request: new Request("http://radarboard.local/api/briefing"),
      body: {},
    });
    if (result.status >= 400) {
      const payload = result.payload as { error?: unknown };
      return errorJson(result.status, String(payload.error ?? "Failed to generate briefing"));
    }
    return NextResponse.json(result.payload);
  } catch (err) {
    log.error("briefing failed", { error: err instanceof Error ? err.message : String(err) });
    return errorJson(500, "Failed to generate briefing");
  }
}
