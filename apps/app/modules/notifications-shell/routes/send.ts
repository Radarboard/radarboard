import { createLogger } from "@radarboard/logger/logger";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { resolveResendConfig } from "@/lib/credential-resolver";

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
    return errorJson(404, "Resend alert delivery requires the Resend integration", {
      configured: Boolean(config),
      sent: false,
    });
  } catch (error) {
    log.error("Failed to send alert email", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message, { configured: true });
  }
}
