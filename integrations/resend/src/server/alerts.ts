import { sendEmail, sendHealthAlert } from "../api/client";
import type { ResendConfig } from "../types";

export type AlertBody = {
  type: "health" | "custom";
  name?: string;
  url?: string;
  status?: "down" | "degraded";
  responseTimeMs?: number;
  checkedAt?: string;
  subject?: string;
  html?: string;
  text?: string;
};

export type AlertSendResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      emailId: string;
      notification: {
        type: string;
        severity: "critical" | "warning" | "info";
        title: string;
        body: string | null;
        metadata: Record<string, unknown>;
      };
    };

export async function sendAlertViaResend(
  config: ResendConfig,
  body: AlertBody
): Promise<AlertSendResult> {
  if (body.type === "health") {
    if (!body.name || !body.url || !body.status) {
      return { ok: false, status: 400, error: "Missing required fields: name, url, status" };
    }

    const checkedAt = body.checkedAt ?? new Date().toISOString();
    const result = await sendHealthAlert(config, {
      name: body.name,
      url: body.url,
      status: body.status,
      responseTimeMs: body.responseTimeMs,
      checkedAt,
    });

    return {
      ok: true,
      emailId: result.id,
      notification: {
        type: `health.${body.status}`,
        severity: body.status === "down" ? "critical" : "warning",
        title: `${body.name} is ${body.status}`,
        body: `${body.url}${body.responseTimeMs ? ` • ${body.responseTimeMs}ms` : ""}`,
        metadata: {
          name: body.name,
          url: body.url,
          status: body.status,
          responseTimeMs: body.responseTimeMs ?? null,
          checkedAt,
          emailId: result.id,
        },
      },
    };
  }

  if (body.type === "custom") {
    if (!body.subject || !body.html) {
      return { ok: false, status: 400, error: "Missing required fields: subject, html" };
    }

    const result = await sendEmail(config, {
      subject: body.subject,
      html: body.html,
      text: body.text,
    });

    return {
      ok: true,
      emailId: result.id,
      notification: {
        type: "custom.sent",
        severity: "info",
        title: body.subject,
        body: body.text ?? null,
        metadata: {
          emailId: result.id,
        },
      },
    };
  }

  return { ok: false, status: 400, error: "Invalid alert type" };
}
