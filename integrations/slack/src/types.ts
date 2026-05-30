/**
 * Slack — Data types
 */

export interface SlackConfig {
  webhookUrl: string;
}

export interface SendMessageInput {
  message: string;
  channel?: string;
  blocks?: unknown[];
}

export interface SendMessageResult {
  success: boolean;
}
