import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getExtensionUsageSummary,
  trackExtensionError,
  trackExtensionMount,
} from "@/db/sqlite-extension-usage";
import { errorJson, parseBody } from "@/lib/api";

const log = createLogger("api/extensions/usage");
const extensionUsageSchema = z.object({
  extensionId: z.string().min(1),
  extensionType: z.enum(["integration", "plugin", "widget"]),
  event: z.enum(["mount", "error"]).optional(),
});

export async function handleGetExtensionUsage() {
  try {
    const summary = await getExtensionUsageSummary();
    return NextResponse.json({ usage: summary });
  } catch (err) {
    log.error("Failed to fetch extension usage data", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Failed to fetch usage data");
  }
}

export async function handleTrackExtensionUsage(request: Request) {
  try {
    const parsed = await parseBody(request, extensionUsageSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    if (body.event === "error") {
      await trackExtensionError(body.extensionId, body.extensionType);
    } else {
      await trackExtensionMount(body.extensionId, body.extensionType);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Failed to track extension usage", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Failed to track");
  }
}
