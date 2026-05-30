import { beforeEach, describe, expect, it, vi } from "vitest";

const emitNotificationEventMock = vi.fn();
const emitDebugEventMock = vi.fn();

vi.mock("@/lib/notifications", () => ({
  emitNotificationEvent: (...args: unknown[]) => emitNotificationEventMock(...args),
}));

vi.mock("@/lib/debug-events", () => ({
  emitDebugEvent: (...args: unknown[]) => emitDebugEventMock(...args),
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

import { handleEmitNotification as POST } from "../emit";

beforeEach(() => {
  emitNotificationEventMock.mockReset();
  emitDebugEventMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/notifications/emit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const validEvent = {
  source: "github",
  type: "push",
  severity: "info" as const,
  title: "New commit pushed",
  body: "3 new commits to main",
  metadata: { repo: "radarboard" },
  projectSlug: "my-project",
  sourceEventId: "evt_123",
};

describe("POST /api/notifications/emit", () => {
  it("emits a valid notification event", async () => {
    emitNotificationEventMock.mockResolvedValue(undefined);
    emitDebugEventMock.mockResolvedValue(undefined);

    const res = await POST(makeRequest(validEvent));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(emitNotificationEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "github",
        type: "push",
        severity: "info",
        title: "New commit pushed",
      })
    );
  });

  it("emits a debug event alongside the notification", async () => {
    emitNotificationEventMock.mockResolvedValue(undefined);
    emitDebugEventMock.mockResolvedValue(undefined);

    await POST(makeRequest(validEvent));

    expect(emitDebugEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "notification.emit",
        status: "completed",
        metadata: expect.objectContaining({
          source: "github",
          type: "push",
          severity: "info",
        }),
      })
    );
  });

  it("accepts minimal required fields", async () => {
    emitNotificationEventMock.mockResolvedValue(undefined);
    emitDebugEventMock.mockResolvedValue(undefined);

    const minimal = {
      source: "sentry",
      type: "alert",
      severity: "critical",
      title: "Error spike",
    };

    const res = await POST(makeRequest(minimal));
    expect(res.status).toBe(200);
  });

  it("rejects missing source", async () => {
    const { source: _, ...noSource } = validEvent;
    const res = await POST(makeRequest(noSource));
    expect(res.status).toBe(400);
  });

  it("rejects missing type", async () => {
    const { type: _, ...noType } = validEvent;
    const res = await POST(makeRequest(noType));
    expect(res.status).toBe(400);
  });

  it("rejects invalid severity", async () => {
    const res = await POST(makeRequest({ ...validEvent, severity: "extreme" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing title", async () => {
    const res = await POST(makeRequest({ ...validEvent, title: "" }));
    expect(res.status).toBe(400);
  });

  it("allows null body", async () => {
    emitNotificationEventMock.mockResolvedValue(undefined);
    emitDebugEventMock.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ ...validEvent, body: null }));
    expect(res.status).toBe(200);
  });
});
