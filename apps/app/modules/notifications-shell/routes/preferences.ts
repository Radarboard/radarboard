import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { getNotificationPreferences, upsertNotificationPreference } from "@/lib/notifications";

const PreferenceSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  preset: z.enum(["all", "critical_only", "deploys_and_errors", "custom"]),
  digestWindow: z.number().int().min(60).max(86_400),
  channels: z.array(z.enum(["in_app", "email", "desktop", "webhook", "mcp", "sound"])),
  quietHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().min(1),
    })
    .nullable(),
  sounds: z.record(z.enum(["critical", "warning", "info", "success"]), z.string()).optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});

export const handleGetNotificationPreferences = withLogging(
  API_ROUTES.notificationPreferences,
  async () => {
    const preferences = await getNotificationPreferences();
    return NextResponse.json({ preferences });
  }
);

export const handleUpsertNotificationPreferences = withLogging(
  API_ROUTES.notificationPreferences,
  async (request: Request) => {
    const parsed = await parseBody(request, PreferenceSchema);
    if (!parsed.ok) return parsed.response;

    await upsertNotificationPreference({
      ...parsed.data,
      updatedAt: parsed.data.updatedAt ?? Math.floor(Date.now() / 1000),
    });

    return NextResponse.json({ success: true });
  }
);
