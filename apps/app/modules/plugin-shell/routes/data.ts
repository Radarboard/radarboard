import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPluginRepo } from "@/db/repository";
import { errorJson, parseBody, parseSearchParams } from "@/lib/api";
import { emitDebugEvent } from "@/lib/debug-events";
import { verifyPluginToken } from "@/lib/plugin-token";

const log = createLogger("api/plugins/data");

const GetSchema = z.object({
  pluginId: z.string().min(1, "pluginId is required"),
  key: z.string().min(1, "key is required"),
});

/** GET /api/plugins/data?pluginId=...&key=... */
export async function handleGetPluginData(request: Request) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, GetSchema);
  if (!parsed.ok) return parsed.response;

  const { pluginId, key } = parsed.data;

  const token = request.headers.get("X-Plugin-Token");
  if (!verifyPluginToken(token, pluginId)) {
    return errorJson(403, "Invalid or missing plugin token");
  }

  try {
    const repo = getPluginRepo();
    const value = await repo.get(pluginId, key);
    await emitDebugEvent({
      level: "info",
      source: "api/plugins/data",
      eventType: "plugin.data.read",
      message: "Plugin data read",
      entityType: "plugin",
      entityId: pluginId,
      status: "completed",
      metadata: { key, found: value !== null },
    });
    return NextResponse.json({ value });
  } catch (err) {
    await emitDebugEvent({
      level: "error",
      source: "api/plugins/data",
      eventType: "plugin.data.read",
      message: "Plugin data read failed",
      entityType: "plugin",
      entityId: pluginId,
      status: "failed",
      metadata: { key, error: String(err) },
    });
    log.error("GET error", { pluginId, key, error: String(err) });
    return errorJson(500, "Failed to read plugin data");
  }
}

const PutSchema = z.object({
  pluginId: z.string().min(1),
  key: z.string().min(1),
  value: z.string(),
});

/** PUT /api/plugins/data — upsert a plugin data entry */
export async function handlePutPluginData(request: Request) {
  const parsed = await parseBody(request, PutSchema);
  if (!parsed.ok) return parsed.response;

  const token = request.headers.get("X-Plugin-Token");
  if (!verifyPluginToken(token, parsed.data.pluginId)) {
    return errorJson(403, "Invalid or missing plugin token");
  }

  try {
    const repo = getPluginRepo();
    await repo.set(parsed.data.pluginId, parsed.data.key, parsed.data.value);
    await emitDebugEvent({
      level: "info",
      source: "api/plugins/data",
      eventType: "plugin.data.write",
      message: "Plugin data written",
      entityType: "plugin",
      entityId: parsed.data.pluginId,
      status: "completed",
      metadata: { key: parsed.data.key },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await emitDebugEvent({
      level: "error",
      source: "api/plugins/data",
      eventType: "plugin.data.write",
      message: "Plugin data write failed",
      entityType: "plugin",
      entityId: parsed.data.pluginId,
      status: "failed",
      metadata: { key: parsed.data.key, error: String(err) },
    });
    log.error("PUT error", {
      pluginId: parsed.data.pluginId,
      key: parsed.data.key,
      error: String(err),
    });
    return errorJson(500, "Failed to write plugin data");
  }
}

const DeleteSchema = z.object({
  pluginId: z.string().min(1),
  key: z.string().min(1),
});

/** DELETE /api/plugins/data — remove a plugin data entry */
export async function handleDeletePluginData(request: Request) {
  const parsed = await parseBody(request, DeleteSchema);
  if (!parsed.ok) return parsed.response;

  const token = request.headers.get("X-Plugin-Token");
  if (!verifyPluginToken(token, parsed.data.pluginId)) {
    return errorJson(403, "Invalid or missing plugin token");
  }

  try {
    const repo = getPluginRepo();
    await repo.delete(parsed.data.pluginId, parsed.data.key);
    await emitDebugEvent({
      level: "info",
      source: "api/plugins/data",
      eventType: "plugin.data.delete",
      message: "Plugin data deleted",
      entityType: "plugin",
      entityId: parsed.data.pluginId,
      status: "completed",
      metadata: { key: parsed.data.key },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await emitDebugEvent({
      level: "error",
      source: "api/plugins/data",
      eventType: "plugin.data.delete",
      message: "Plugin data delete failed",
      entityType: "plugin",
      entityId: parsed.data.pluginId,
      status: "failed",
      metadata: { key: parsed.data.key, error: String(err) },
    });
    log.error("DELETE error", {
      pluginId: parsed.data.pluginId,
      key: parsed.data.key,
      error: String(err),
    });
    return errorJson(500, "Failed to delete plugin data");
  }
}
