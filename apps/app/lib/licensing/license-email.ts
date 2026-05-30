/**
 * Send license key delivery emails after purchase.
 *
 * Uses Resend API directly with env var credentials (RESEND_API_KEY, RESEND_FROM_EMAIL).
 * This is separate from the integration-level Resend config since license delivery
 * is infrastructure, not a user-configured notification channel.
 */

import { createLogger } from "@radarboard/logger/logger";
import { getWebEnv } from "@/lib/system/runtime/env";

const log = createLogger("license-email");

interface LicenseEmailOptions {
  to: string;
  licenseKey: string;
  plan: string;
  expiresAt: string;
}

/**
 * Send a license key delivery email to the buyer.
 * Silently skips if Resend is not configured.
 */
export async function sendLicenseKeyEmail(options: LicenseEmailOptions): Promise<boolean> {
  const apiKey = getWebEnv("RESEND_API_KEY");
  const fromEmail = getWebEnv("RESEND_FROM_EMAIL");

  if (!apiKey || !fromEmail) {
    log.warn("Resend not configured, skipping license email", { to: options.to });
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        // biome-ignore lint/style/useNamingConvention: HTTP header
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [options.to],
        subject: `Your Radarboard Pro License Key`,
        html: buildLicenseEmailHtml(options),
        text: buildLicenseEmailText(options),
        tags: [{ name: "type", value: "license-delivery" }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("Failed to send license email", { status: res.status, body });
      return false;
    }

    log.info("License email sent", { to: options.to, plan: options.plan });
    return true;
  } catch (err) {
    log.error("License email error", { error: err });
    return false;
  }
}

function buildLicenseEmailHtml(options: LicenseEmailOptions): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">Welcome to Radarboard Pro</h2>
      <p style="color: #666; margin-top: 0;">Thank you for your purchase. Here's your license key:</p>

      <div style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">License Key</p>
        <code style="display: block; word-break: break-all; font-size: 13px; line-height: 1.5; color: #333; background: #fff; padding: 12px; border-radius: 4px; border: 1px solid #e0e0e0;">${options.licenseKey}</code>
      </div>

      <h3 style="margin-bottom: 8px;">How to activate</h3>
      <ol style="color: #444; line-height: 1.8;">
        <li>Open Radarboard (desktop app or web)</li>
        <li>Go to <strong>Settings → Features → License</strong></li>
        <li>Paste the license key above and click <strong>Activate</strong></li>
      </ol>

      <table style="margin: 24px 0; border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 100px;">Plan</td>
          <td style="padding: 8px 0; font-weight: 600;">${options.plan}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Expires</td>
          <td style="padding: 8px 0;">${options.expiresAt}</td>
        </tr>
      </table>

      <p style="color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
        Keep this email safe — you'll need this key if you reinstall or switch devices.<br/>
        Questions? Reply to this email.
      </p>
    </div>
  `;
}

function buildLicenseEmailText(options: LicenseEmailOptions): string {
  return [
    "Welcome to Radarboard Pro",
    "",
    "Here's your license key:",
    "",
    options.licenseKey,
    "",
    "How to activate:",
    "1. Open Radarboard (desktop app or web)",
    "2. Go to Settings → Features → License",
    "3. Paste the key and click Activate",
    "",
    `Plan: ${options.plan}`,
    `Expires: ${options.expiresAt}`,
    "",
    "Keep this email safe — you'll need this key if you reinstall or switch devices.",
  ].join("\n");
}
