import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPluginRepo } from "@/db/repository";
import { errorJson, parseSearchParams } from "@/lib/api";
import { emitDebugEvent } from "@/lib/debug-events";
import { verifyPluginToken } from "@/lib/plugin-token";

const log = createLogger("api/plugins/data/list");

const ListSchema = z.object({
  pluginId: z.string().min(1, "pluginId is required"),
  prefix: z.string().default(""),
});

/** GET /api/plugins/data/list?pluginId=...&prefix=... */
export async function handleListPluginData(request: Request) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, ListSchema);
  if (!parsed.ok) return parsed.response;

  const { pluginId, prefix } = parsed.data;

  const token = request.headers.get("X-Plugin-Token");
  if (!verifyPluginToken(token, pluginId)) {
    return errorJson(403, "Invalid or missing plugin token");
  }

  try {
    const repo = getPluginRepo();
    const items = await repo.list(pluginId, prefix);
    await emitDebugEvent({
      level: "info",
      source: "api/plugins/data/list",
      eventType: "plugin.data.list",
      message: "Plugin data listed",
      entityType: "plugin",
      entityId: pluginId,
      status: "completed",
      metadata: { prefix, count: items.length },
    });
    return NextResponse.json({ items });
  } catch (err) {
    await emitDebugEvent({
      level: "error",
      source: "api/plugins/data/list",
      eventType: "plugin.data.list",
      message: "Plugin data list failed",
      entityType: "plugin",
      entityId: pluginId,
      status: "failed",
      metadata: { prefix, error: String(err) },
    });
    log.error("GET error", { pluginId, prefix, error: String(err) });
    return errorJson(500, "Failed to list plugin data");
  }
}
