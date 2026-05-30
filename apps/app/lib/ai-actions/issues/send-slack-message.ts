/**
 * AI Action: Send a Slack message.
 *
 * Delegates to the Slack integration client for all API calls.
 * Rate limited via the outbound rate limiter.
 */

import { sendMessage } from "@radarboard/integration-slack/client";
import type { SendMessageInput, SlackConfig } from "@radarboard/integration-slack/types";
import { withOutboundRateLimit } from "@/lib/outbound-rate-limit";

export type { SendMessageInput };

export async function executeSendSlackMessage(config: SlackConfig, input: SendMessageInput) {
  return withOutboundRateLimit("slack", () => sendMessage(config, input));
}
