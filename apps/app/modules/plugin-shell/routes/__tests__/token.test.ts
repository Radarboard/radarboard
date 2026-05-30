import { beforeEach, describe, expect, it, vi } from "vitest";

const signPluginTokenMock = vi.fn();

vi.mock("@/lib/plugin-token", () => ({
  signPluginToken: (...args: unknown[]) => signPluginTokenMock(...args),
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

import { handleIssuePluginToken as POST } from "@/modules/plugin-shell/routes/token";

beforeEach(() => {
  signPluginTokenMock.mockReset();
});

function makeRequest(payload: unknown): Request {
  return new Request("http://localhost/api/plugins/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/plugins/token", () => {
  it("returns a signed token for a valid plugin id", async () => {
    signPluginTokenMock.mockReturnValue("eyJ.signed.token");

    const res = await POST(makeRequest({ pluginId: "notes" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe("eyJ.signed.token");
    expect(signPluginTokenMock).toHaveBeenCalledWith("notes");
  });

  it("rejects missing pluginId", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects empty pluginId", async () => {
    const res = await POST(makeRequest({ pluginId: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when token signing fails", async () => {
    signPluginTokenMock.mockImplementation(() => {
      throw new Error("Secret not configured");
    });

    const res = await POST(makeRequest({ pluginId: "notes" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to issue plugin token");
  });
});
