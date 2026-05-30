import { afterEach, describe, expect, it, vi } from "vitest";
import { resetOutboundRateLimits } from "@/lib/outbound-rate-limit";

vi.mock("@radarboard/integration-slack/client", () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

import { executeSendSlackMessage } from "../send-slack-message";

afterEach(() => {
  resetOutboundRateLimits();
});

describe("executeSendSlackMessage", () => {
  it("delegates to the integration client with rate limiting", async () => {
    const result = await executeSendSlackMessage(
      { webhookUrl: "https://hooks.slack.com/test" },
      { message: "Alert: revenue dropped!" }
    );
    expect(result.success).toBe(true);
  });

  it("passes channel when provided", async () => {
    const { sendMessage } = await import("@radarboard/integration-slack/client");
    await executeSendSlackMessage(
      { webhookUrl: "https://hooks.slack.com/test" },
      { message: "test", channel: "#alerts" }
    );
    expect(sendMessage).toHaveBeenCalledWith(
      { webhookUrl: "https://hooks.slack.com/test" },
      { message: "test", channel: "#alerts" }
    );
  });
});
