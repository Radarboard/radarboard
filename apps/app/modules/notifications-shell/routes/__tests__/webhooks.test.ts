import type { NotificationRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getNotificationRepo: vi.fn(),
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

vi.mock("@radarboard/logger/middleware", () => ({
  withLogging: (_name: string, handler: (...args: never[]) => unknown) => handler,
}));

import { getNotificationRepo } from "@/db/repository";
import {
  handleDeleteWebhook as DELETE,
  handleGetWebhooks as GET,
  handleUpsertWebhook as POST,
} from "../webhooks";

type WebhookMethods = Pick<
  NotificationRepository,
  "getWebhookEndpoints" | "upsertWebhookEndpoint" | "deleteWebhookEndpoint"
>;

const mockRepo: Record<keyof WebhookMethods, ReturnType<typeof vi.fn>> = {
  getWebhookEndpoints: vi.fn(),
  upsertWebhookEndpoint: vi.fn(),
  deleteWebhookEndpoint: vi.fn(),
};

beforeEach(() => {
  for (const fn of Object.values(mockRepo)) fn.mockReset();
  vi.mocked(getNotificationRepo).mockReturnValue(mockRepo as unknown as NotificationRepository);
});

/* ------------------------------------------------------------------ */
/*  GET                                                                */
/* ------------------------------------------------------------------ */
describe("GET /api/notifications/webhooks", () => {
  it("returns endpoints with masked secrets", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([
      {
        id: "wh1",
        name: "Slack",
        url: "https://webhook.example.test/x",
        secret: "super-secret-12345678",
        events: ["deploy"],
        enabled: true,
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.endpoints).toHaveLength(1);
    expect(body.endpoints[0].secret).toBe("••••••••••••••••");
    expect(body.endpoints[0].name).toBe("Slack");
  });

  it("never leaks raw secrets", async () => {
    const rawSecret = "my-super-secret-webhook-key-1234";
    mockRepo.getWebhookEndpoints.mockResolvedValue([
      {
        id: "wh2",
        name: "Discord",
        url: "https://webhook2.example.test/ingest",
        secret: rawSecret,
        events: ["alert"],
        enabled: true,
      },
    ]);

    const res = await GET();
    const text = await res.text();

    expect(text).not.toContain(rawSecret);
  });

  it("returns empty array when no provider", async () => {
    vi.mocked(getNotificationRepo).mockReturnValue(null as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.endpoints).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  POST                                                               */
/* ------------------------------------------------------------------ */
describe("POST /api/notifications/webhooks", () => {
  const validWebhook = {
    id: "wh1",
    name: "Slack Webhook",
    url: "https://webhook.example.test/services/T00/B00/xxx",
    secret: "super-secret-key-1234",
    events: ["deploy.success"],
    enabled: true,
  };

  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/notifications/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("creates a valid webhook endpoint", async () => {
    mockRepo.upsertWebhookEndpoint.mockResolvedValue(undefined);

    const res = await POST(makeRequest(validWebhook));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.upsertWebhookEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "wh1",
        name: "Slack Webhook",
        url: "https://webhook.example.test/services/T00/B00/xxx",
      })
    );
  });

  it("auto-fills createdAt when not provided", async () => {
    mockRepo.upsertWebhookEndpoint.mockResolvedValue(undefined);

    await POST(makeRequest(validWebhook));

    const saved = mockRepo.upsertWebhookEndpoint.mock.calls[0][0];
    expect(saved.createdAt).toBeTypeOf("number");
    expect(saved.createdAt).toBeGreaterThan(0);
  });

  it("returns 501 when no notification provider", async () => {
    vi.mocked(getNotificationRepo).mockReturnValue(null as any);

    const res = await POST(makeRequest(validWebhook));
    expect(res.status).toBe(501);
  });

  it("rejects invalid URL", async () => {
    const res = await POST(makeRequest({ ...validWebhook, url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("rejects secret shorter than 16 characters", async () => {
    const res = await POST(makeRequest({ ...validWebhook, secret: "short" }));
    expect(res.status).toBe(400);
  });

  it("rejects empty events array", async () => {
    const res = await POST(makeRequest({ ...validWebhook, events: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const { name: _, ...noName } = validWebhook;
    const res = await POST(makeRequest(noName));
    expect(res.status).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  DELETE                                                             */
/* ------------------------------------------------------------------ */
describe("DELETE /api/notifications/webhooks", () => {
  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/notifications/webhooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("deletes a webhook by id", async () => {
    mockRepo.deleteWebhookEndpoint.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest({ id: "wh1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.deleteWebhookEndpoint).toHaveBeenCalledWith("wh1");
  });

  it("returns 501 when no provider", async () => {
    vi.mocked(getNotificationRepo).mockReturnValue(null as any);

    const res = await DELETE(makeRequest({ id: "wh1" }));
    expect(res.status).toBe(501);
  });

  it("rejects missing id", async () => {
    const res = await DELETE(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
