import { type AlertBody, sendAlertViaResend } from "@radarboard/integration-resend/server/alerts";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { resolveResendConfig } from "@/lib/credential-resolver";
import { emitNotificationEvent } from "@/lib/notifications";

const log = createLogger("api/alerts/send");
const alertBodySchema = z.record(z.string(), z.unknown());

/**
 * POST /api/notifications/send
 *
 * Sends an alert email via Resend.
 */
export async function handleSendAlert(request: Request): Promise<Response> {
  const config = await resolveResendConfig();
  if (!config) {
    return errorJson(200, "Resend not configured", { configured: false });
  }

  try {
    const parsed = await parseBody(request, alertBodySchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data as unknown as AlertBody;
    const result = await sendAlertViaResend(config, body);
    if (!result.ok) {
      return errorJson(result.status, result.error);
    }

    await emitNotificationEvent({
      source: "alerts",
      ...result.notification,
    });

    return NextResponse.json({ configured: true, sent: true, emailId: result.emailId });
  } catch (error) {
    log.error("Failed to send alert email", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message, { configured: true });
  }
}
