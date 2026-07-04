/**
 * HTTP surface for managing user-created (no-code) REST integrations.
 *
 * These delegate to the same executors the assistant/MCP tools use, so the
 * Settings UI, the in-app assistant, and external MCP clients all share one
 * implementation. Read + delete only — creation stays on create_rest_integration.
 */
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";

const log = createLogger("api/system/user-integrations");

/** GET /api/system/user-integrations — list the user-created REST integrations. */
export async function handleListUserIntegrations() {
  try {
    const { executeListUserIntegrations } = await import(
      "@/lib/ai-actions/dashboard/connect-integration"
    );
    return NextResponse.json(await executeListUserIntegrations());
  } catch (err) {
    log.error("Failed to list user integrations", {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorJson(500, "Failed to list user integrations");
  }
}

/**
 * DELETE /api/system/user-integrations/:id — remove one user-created integration
 * and its dedicated widget. Idempotent: removing an unknown id still returns 200
 * (with `removed: false`) so the client can simply refetch.
 */
export async function handleRemoveUserIntegration(id: string) {
  if (!id) return errorJson(400, "Missing integration id");
  try {
    const { executeRemoveIntegration } = await import(
      "@/lib/ai-actions/dashboard/connect-integration"
    );
    const result = await executeRemoveIntegration({ id });
    if (result.error) return errorJson(500, result.error);
    return NextResponse.json(result);
  } catch (err) {
    log.error("Failed to remove user integration", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorJson(500, "Failed to remove user integration");
  }
}
