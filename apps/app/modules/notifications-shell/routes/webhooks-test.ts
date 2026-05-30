import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { sendTestWebhook } from "@/lib/notification-webhooks";

const TestSchema = z.object({
  id: z.string().min(1),
});

export const handleTestWebhook = withLogging(
  API_ROUTES.notificationWebhooksTest,
  async (request: Request) => {
    const parsed = await parseBody(request, TestSchema);
    if (!parsed.ok) return parsed.response;

    const result = await sendTestWebhook(parsed.data.id);
    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  }
);
