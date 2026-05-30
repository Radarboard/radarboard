/**
 * POST /api/notifications/emit
 *
 * Internal route used by the client-side PluginAPI.events.emit().
 * Runs the full server-side pipeline: dedup, preferences, accumulator, delivery.
 */

import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { emitDebugEvent } from "@/lib/debug-events";
import { emitNotificationEvent } from "@/lib/notifications";

const EmitSchema = z.object({
  source: z.string().min(1),
  type: z.string().min(1),
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  projectSlug: z.string().nullable().optional(),
  sourceEventId: z.string().nullable().optional(),
});

export const handleEmitNotification = withLogging(
  API_ROUTES.notificationEmit,
  async (request: Request) => {
    const parsed = await parseBody(request, EmitSchema);
    if (!parsed.ok) return parsed.response;

    await emitNotificationEvent(parsed.data);
    await emitDebugEvent({
      level: "info",
      source: "api/notifications/emit",
      eventType: "notification.emit",
      message: "Notification event emitted",
      projectSlug: parsed.data.projectSlug ?? null,
      entityType: "notification",
      entityId: parsed.data.sourceEventId ?? null,
      status: "completed",
      metadata: {
        source: parsed.data.source,
        type: parsed.data.type,
        severity: parsed.data.severity,
        title: parsed.data.title,
      },
    });
    return NextResponse.json({ received: true });
  }
);
