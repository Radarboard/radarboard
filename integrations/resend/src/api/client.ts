/**
 * Resend email API client for alert notifications.
 *
 * Used to send email alerts for health check failures, revenue anomalies,
 * and other notable events detected by the dashboard.
 *
 * Rate limit: 2 requests per second (free tier), 100/s (pro).
 *
 * @see https://resend.com/docs/api-reference
 */

import type { ResendConfig, ResendEmail, SendEmailOptions, SendEmailResponse } from "../types";

const BASE_URL = "https://api.resend.com";

// --- Error ---

export class ResendAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "ResendAPIError";
  }
}

// --- Fetcher ---

async function fetchResend<T>(
  config: ResendConfig,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new ResendAPIError(
      response.status,
      `Resend API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  return (await response.json()) as T;
}

// --- Public API ---

/**
 * Send an email via Resend.
 */
export async function sendEmail(
  config: ResendConfig,
  options: SendEmailOptions
): Promise<SendEmailResponse> {
  const to = options.to ?? config.toEmail;
  return fetchResend<SendEmailResponse>(config, "/emails", {
    method: "POST",
    body: JSON.stringify({
      from: config.fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      tags: options.tags,
    }),
  });
}

/**
 * Send a health alert email.
 * Convenience wrapper with pre-formatted HTML for health check failures.
 */
export async function sendHealthAlert(
  config: ResendConfig,
  alert: {
    name: string;
    url: string;
    status: "down" | "degraded";
    responseTimeMs?: number;
    checkedAt: string;
  }
): Promise<SendEmailResponse> {
  const statusColor = alert.status === "down" ? "#EF4444" : "#F59E0B";
  const statusLabel = alert.status === "down" ? "DOWN" : "DEGRADED";

  return sendEmail(config, {
    subject: `[${statusLabel}] ${alert.name} - Radarboard`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${statusColor};">${statusLabel}: ${alert.name}</h2>
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">URL</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><a href="${alert.url}">${alert.url}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Status</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor};">${statusLabel}</td>
          </tr>
          ${
            alert.responseTimeMs != null
              ? `<tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Response Time</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${alert.responseTimeMs}ms</td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Checked At</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${alert.checkedAt}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 16px;">
          Sent by Radarboard
        </p>
      </div>
    `,
    text: `${statusLabel}: ${alert.name}\nURL: ${alert.url}\nChecked at: ${alert.checkedAt}`,
    tags: [
      { name: "type", value: "health-alert" },
      { name: "status", value: alert.status },
    ],
  });
}

/**
 * Get recent emails sent (for audit/debugging).
 */
export async function getRecentEmails(config: ResendConfig, limit = 10): Promise<ResendEmail[]> {
  const result = await fetchResend<{ data: ResendEmail[] }>(config, `/emails?limit=${limit}`);
  return result.data;
}
