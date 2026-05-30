import { beforeEach, describe, expect, it, vi } from "vitest";

const pollWebhookRelayMock = vi.fn();

vi.mock("@radarboard/plugin-webhook-relay/server/poll-relay", () => ({
  pollWebhookRelay: (...args: unknown[]) => pollWebhookRelayMock(...args),
}));

vi.mock("@/data/core/repository", () => ({
  getSettingsRepo: () => ({
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("@/lib/env", () => ({
  getWebEnv: vi.fn(),
  WEB_ENV_KEYS: { relay: { secret: "RELAY_SECRET" } },
}));

vi.mock("@/lib/integration-artifacts", () => ({
  persistIntegrationArtifacts: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  emitNotificationEvents: vi.fn(),
}));

vi.mock("@/lib/debug-events", () => ({
  emitDebugEvent: vi.fn(),
}));

type SchemaLike = {
  safeParse: (value: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues?: Array<{ path: (string | number)[]; message: string }> };
  };
};

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    parseBody: async (request: Request, schema: SchemaLike) => {
      const payload = await request.json();
      const result = schema.safeParse(payload);
      if (result.success) return { ok: true as const, data: result.data };
      const issues = result.error?.issues ?? [];
      return {
        ok: false as const,
        response: new Response(
          JSON.stringify({
            error: issues[0]?.message ?? "Invalid request",
            issues: issues.map((e) => ({ path: e.path, message: e.message })),
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        ),
      };
    },
  };
});

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("@radarboard/logger/middleware", () => ({
  withLogging: (_name: string, handler: (...args: never[]) => unknown) => handler,
}));

import { handleWebhookRelayPoll as POST } from "@/modules/plugin-shell/routes/webhook-relay-poll";

beforeEach(() => {
  pollWebhookRelayMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/relay/poll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/plugins/webhook-relay/poll", () => {
  it("returns configured=false when relay returns null", async () => {
    pollWebhookRelayMock.mockResolvedValue(null);

    const res = await POST(makeRequest({ since: 0 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.configured).toBe(false);
  });

  it("returns event count and relay timestamp on success", async () => {
    pollWebhookRelayMock.mockResolvedValue({
      eventCount: 5,
      relayTimestamp: 1700000000,
    });

    const res = await POST(makeRequest({ since: 1699999000 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.eventCount).toBe(5);
    expect(body.relayTimestamp).toBe(1700000000);
  });

  it("passes since parameter to pollWebhookRelay", async () => {
    pollWebhookRelayMock.mockResolvedValue(null);

    await POST(makeRequest({ since: 42 }));

    expect(pollWebhookRelayMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        getRelayUrl: expect.any(Function),
        getRelaySecret: expect.any(Function),
      })
    );
  });

  it("rejects negative since values", async () => {
    const res = await POST(makeRequest({ since: -1 }));
    expect(res.status).toBe(400);
  });

  it("rejects non-integer since values", async () => {
    const res = await POST(makeRequest({ since: 1.5 }));
    expect(res.status).toBe(400);
  });

  it("rejects missing since", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 500 when poll throws", async () => {
    pollWebhookRelayMock.mockRejectedValue(new Error("Connection refused"));

    const res = await POST(makeRequest({ since: 0 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Relay poll failed");
  });
});
