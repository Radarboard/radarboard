import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTestWebhookMock = vi.fn();

vi.mock("@/lib/notification-webhooks", () => ({
  sendTestWebhook: (...args: unknown[]) => sendTestWebhookMock(...args),
}));

type SchemaLike = {
  safeParse: (value: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues?: Array<{ path: (string | number)[]; message: string }> };
  };
};

vi.mock("@/lib/api", () => ({
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
}));

vi.mock("@radarboard/logger/middleware", () => ({
  withLogging: (_name: string, handler: (...args: never[]) => unknown) => handler,
}));

import { handleTestWebhook as POST } from "../webhooks-test";

beforeEach(() => {
  sendTestWebhookMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/notifications/webhooks/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/notifications/webhooks/test", () => {
  it("sends a test webhook and returns success", async () => {
    sendTestWebhookMock.mockResolvedValue({
      ok: true,
      statusCode: 200,
      responseTime: 42,
    });

    const res = await POST(makeRequest({ id: "wh1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendTestWebhookMock).toHaveBeenCalledWith("wh1");
  });

  it("returns 500 when webhook test fails", async () => {
    sendTestWebhookMock.mockResolvedValue({
      ok: false,
      error: "Connection refused",
    });

    const res = await POST(makeRequest({ id: "wh1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Connection refused");
  });

  it("rejects missing id", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects empty id", async () => {
    const res = await POST(makeRequest({ id: "" }));
    expect(res.status).toBe(400);
  });
});
