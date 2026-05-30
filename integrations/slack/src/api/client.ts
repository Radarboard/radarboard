/**
 * Slack API client for the Radarboard dashboard.
 *
 * Uses Slack incoming webhooks to send messages.
 * Authenticated via webhook URL stored in credentials.
 *
 * @see https://api.slack.com/messaging/webhooks
 */

import type { SendMessageInput, SendMessageResult, SlackConfig } from "../types";

export class SlackAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "SlackAPIError";
  }
}

/**
 * Send a message to Slack via incoming webhook.
 */
export async function sendMessage(
  config: SlackConfig,
  input: SendMessageInput
): Promise<SendMessageResult> {
  const payload: Record<string, unknown> = { text: input.message };
  if (input.channel) payload.channel = input.channel;
  if (input.blocks?.length) payload.blocks = input.blocks;

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new SlackAPIError(
      response.status,
      `Slack webhook error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  return { success: true };
}
