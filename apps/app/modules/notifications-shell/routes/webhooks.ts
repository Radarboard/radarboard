import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getNotificationRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";

const WebhookSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.string().min(1)).min(1),
  enabled: z.boolean(),
  createdAt: z.number().int().nonnegative().optional(),
});

const DeleteSchema = z.object({ id: z.string().min(1) });

export const handleGetWebhooks = withLogging(API_ROUTES.notificationWebhooks, async () => {
  const repo = getNotificationRepo();
  if (!repo) {
    return NextResponse.json({ endpoints: [] });
  }
  const endpoints = await repo.getWebhookEndpoints();
  // Never return the raw secret — return a masked placeholder
  const safe = endpoints.map(({ secret: _secret, ...rest }) => ({
    ...rest,
    secret: "••••••••••••••••",
  }));
  return NextResponse.json({ endpoints: safe });
});

export const handleUpsertWebhook = withLogging(
  API_ROUTES.notificationWebhooks,
  async (request: Request) => {
    const repo = getNotificationRepo();
    if (!repo) {
      return errorJson(501, "Notifications not supported by current provider");
    }
    const parsed = await parseBody(request, WebhookSchema);
    if (!parsed.ok) return parsed.response;

    await repo.upsertWebhookEndpoint({
      ...parsed.data,
      createdAt: parsed.data.createdAt ?? Math.floor(Date.now() / 1000),
    });
    return NextResponse.json({ success: true });
  }
);

export const handleDeleteWebhook = withLogging(
  API_ROUTES.notificationWebhooks,
  async (request: Request) => {
    const repo = getNotificationRepo();
    if (!repo) {
      return errorJson(501, "Notifications not supported by current provider");
    }
    const parsed = await parseBody(request, DeleteSchema);
    if (!parsed.ok) return parsed.response;

    await repo.deleteWebhookEndpoint(parsed.data.id);
    return NextResponse.json({ success: true });
  }
);
