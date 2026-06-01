export interface SlackConfig {
  webhookUrl: string;
}

export interface SendMessageInput {
  text: string;
  channel?: string;
}

export async function executeSendSlackMessage(_config: SlackConfig, _input: SendMessageInput) {
  return { error: "Slack message sending requires the Slack integration." };
}
