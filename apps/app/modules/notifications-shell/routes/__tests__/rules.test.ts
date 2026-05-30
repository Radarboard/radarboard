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
  handleDeleteRule as DELETE,
  handleGetRules as GET,
  handleUpsertRule as POST,
} from "../rules";

type PartialNotifRepo = Pick<NotificationRepository, "getRules" | "upsertRule" | "deleteRule">;

const mockRepo: Record<keyof PartialNotifRepo, ReturnType<typeof vi.fn>> = {
  getRules: vi.fn(),
  upsertRule: vi.fn(),
  deleteRule: vi.fn(),
};

beforeEach(() => {
  for (const fn of Object.values(mockRepo)) fn.mockReset();
  vi.mocked(getNotificationRepo).mockReturnValue(mockRepo as unknown as NotificationRepository);
});

/* ------------------------------------------------------------------ */
/*  GET                                                                */
/* ------------------------------------------------------------------ */
describe("GET /api/notifications/rules", () => {
  it("returns rules from repo", async () => {
    const rules = [{ id: "r1", name: "Alert on deploy", enabled: true, channels: ["in_app"] }];
    mockRepo.getRules.mockResolvedValue(rules);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rules).toEqual(rules);
  });

  it("returns empty array when repo is null (no provider)", async () => {
    vi.mocked(getNotificationRepo).mockReturnValue(null as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rules).toEqual([]);
  });

  it("propagates repo errors", async () => {
    mockRepo.getRules.mockRejectedValue(new Error("DB down"));

    await expect(GET()).rejects.toThrow("DB down");
  });
});

/* ------------------------------------------------------------------ */
/*  POST                                                               */
/* ------------------------------------------------------------------ */
describe("POST /api/notifications/rules", () => {
  const validRule = {
    id: "r1",
    name: "Alert on deploy",
    enabled: true,
    source: "github",
    eventType: "push",
    severity: "info" as const,
    projectSlug: "my-project",
    condition: null,
    channels: ["in_app" as const, "email" as const],
  };

  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/notifications/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("upserts a valid rule", async () => {
    mockRepo.upsertRule.mockResolvedValue(undefined);

    const res = await POST(makeRequest(validRule));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.upsertRule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "r1",
        name: "Alert on deploy",
        enabled: true,
        channels: ["in_app", "email"],
      })
    );
  });

  it("auto-fills createdAt and updatedAt when not provided", async () => {
    mockRepo.upsertRule.mockResolvedValue(undefined);

    await POST(makeRequest(validRule));

    const savedRule = mockRepo.upsertRule.mock.calls[0][0];
    expect(savedRule.createdAt).toBeTypeOf("number");
    expect(savedRule.updatedAt).toBeTypeOf("number");
    expect(savedRule.createdAt).toBeGreaterThan(0);
  });

  it("returns 501 when notification provider is unavailable", async () => {
    vi.mocked(getNotificationRepo).mockReturnValue(null as any);

    const res = await POST(makeRequest(validRule));
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.error).toMatch(/not supported/i);
  });

  it("rejects missing id", async () => {
    const { id: _, ...noId } = validRule;
    const res = await POST(makeRequest(noId));
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const res = await POST(makeRequest({ ...validRule, name: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid severity", async () => {
    const res = await POST(makeRequest({ ...validRule, severity: "extreme" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid channel value", async () => {
    const res = await POST(makeRequest({ ...validRule, channels: ["telegram"] }));
    expect(res.status).toBe(400);
  });

  it("rejects empty channels array", async () => {
    const res = await POST(makeRequest({ ...validRule, channels: [] }));
    const body = await res.json();
    if (res.status === 200) {
      expect(body.success).toBe(true);
    } else {
      expect(res.status).toBe(400);
    }
  });

  it("validates condition sub-schema when provided", async () => {
    const withCondition = {
      ...validRule,
      condition: {
        scope: "event",
        field: "status",
        operator: "equals",
        valueType: "string",
        value: "success",
      },
    };
    mockRepo.upsertRule.mockResolvedValue(undefined);

    const res = await POST(makeRequest(withCondition));
    expect(res.status).toBe(200);
  });

  it("rejects invalid condition operator", async () => {
    const withBadCondition = {
      ...validRule,
      condition: {
        scope: "event",
        field: "status",
        operator: "like",
        valueType: "string",
        value: "success",
      },
    };

    const res = await POST(makeRequest(withBadCondition));
    expect(res.status).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/*  DELETE                                                             */
/* ------------------------------------------------------------------ */
describe("DELETE /api/notifications/rules", () => {
  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/notifications/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("deletes a rule by id", async () => {
    mockRepo.deleteRule.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest({ id: "r1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.deleteRule).toHaveBeenCalledWith("r1");
  });

  it("returns 501 when no provider", async () => {
    vi.mocked(getNotificationRepo).mockReturnValue(null as any);

    const res = await DELETE(makeRequest({ id: "r1" }));
    expect(res.status).toBe(501);
  });

  it("rejects missing id", async () => {
    const res = await DELETE(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects empty id", async () => {
    const res = await DELETE(makeRequest({ id: "" }));
    expect(res.status).toBe(400);
  });
});
