import { getBriefingRoute } from "@radarboard/feature-briefing";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { buildDataSourceContext } from "@/lib/data-source-context";
import { emitNotificationEvents } from "@/lib/notifications";

const log = createLogger("api/briefing");

/** GET /api/briefing — returns cached briefing or generates a new one. */
export async function handleGetBriefing() {
  try {
    const result = await getBriefingRoute({
      listCredentialKeys: () => getCredentialRepo().listCredentialKeys(),
      buildDataSourceContext,
      emitNotificationEvents,
      onSourceError(integration, action) {
        log.warn("briefing source failed", { integration, action });
      },
    });
    if (!result.ok) {
      return errorJson(result.status, result.error);
    }
    return NextResponse.json(result.briefing);
  } catch (err) {
    log.error("briefing failed", { error: err instanceof Error ? err.message : String(err) });
    return errorJson(500, "Failed to generate briefing");
  }
}
