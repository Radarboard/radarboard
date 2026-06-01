import { afterEach, describe, expect, it } from "vitest";
import { resetOutboundRateLimits } from "@/lib/outbound-rate-limit";

import { executeSendSlackMessage } from "../send-slack-message";

afterEach(() => {
  resetOutboundRateLimits();
});

describe("executeSendSlackMessage", () => {
  it("reports that Slack delivery lives in the integration", async () => {
    const result = await executeSendSlackMessage(
      { webhookUrl: "https://hooks.slack.com/test" },
      { text: "Alert: revenue dropped!" }
    );
    expect(result.error).toContain("Slack message sending requires the Slack integration");
  });
});
