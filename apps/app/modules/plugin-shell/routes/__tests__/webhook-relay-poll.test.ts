import { describe, expect, it } from "vitest";
import { handleWebhookRelayPoll as POST } from "@/modules/plugin-shell/routes/webhook-relay-poll";

describe("POST /api/plugins/webhook-relay/poll", () => {
  it("returns 404 when the webhook relay plugin is not installed", async () => {
    const res = await POST(
      new Request("http://localhost/api/relay/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since: 0 }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("Webhook relay plugin is not installed");
  });
});
