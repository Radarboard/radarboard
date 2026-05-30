import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebEnvMock = vi.fn();
const signLicenseKeyMock = vi.fn();

vi.mock("@/lib/env", () => ({
  getWebEnv: (...args: unknown[]) => getWebEnvMock(...args),
}));

vi.mock("@/lib/license-crypto", () => ({
  signLicenseKey: (...args: unknown[]) => signLicenseKeyMock(...args),
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

import { handleIssueLicense as POST } from "@/modules/settings-shell/license-admin";

beforeEach(() => {
  getWebEnvMock.mockReset();
  signLicenseKeyMock.mockReset();
});

function makeRequest(payload: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/admin/license", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/admin/license", () => {
  const validPayload = {
    email: "user@example.com",
    plan: "pro",
    durationDays: 365,
  };

  it("returns 401 without authorization header", async () => {
    getWebEnvMock.mockReturnValue("my-secret");

    const res = await POST(makeRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with wrong bearer token", async () => {
    getWebEnvMock.mockReturnValue("my-secret");

    const res = await POST(
      makeRequest(validPayload, {
        Authorization: "Bearer wrong-secret",
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 401 when RADARBOARD_API_SECRET is not configured", async () => {
    getWebEnvMock.mockReturnValue(undefined);

    const res = await POST(
      makeRequest(validPayload, {
        Authorization: "Bearer anything",
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 500 when private key is not configured", async () => {
    getWebEnvMock.mockImplementation((key: string) => {
      if (key === "RADARBOARD_API_SECRET") return "my-secret";
      if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return undefined;
      return undefined;
    });

    const res = await POST(
      makeRequest(validPayload, {
        Authorization: "Bearer my-secret",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/License signing key not configured/);
  });

  it("issues a valid license key", async () => {
    getWebEnvMock.mockImplementation((key: string) => {
      if (key === "RADARBOARD_API_SECRET") return "my-secret";
      if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return "base64_private_key";
      return undefined;
    });
    signLicenseKeyMock.mockReturnValue("eyJ.signed.license");

    const res = await POST(
      makeRequest(validPayload, {
        Authorization: "Bearer my-secret",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.licenseKey).toBe("eyJ.signed.license");
    expect(body.plan).toBe("pro");
    expect(body.email).toBe("user@example.com");
    expect(body.issuedAt).toBeDefined();
    expect(body.expiresAt).toBeDefined();
  });

  it("passes correct payload to signLicenseKey", async () => {
    getWebEnvMock.mockImplementation((key: string) => {
      if (key === "RADARBOARD_API_SECRET") return "my-secret";
      if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return "base64_pk";
      return undefined;
    });
    signLicenseKeyMock.mockReturnValue("token");

    await POST(
      makeRequest(validPayload, {
        Authorization: "Bearer my-secret",
      })
    );

    expect(signLicenseKeyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "pro",
        email: "user@example.com",
      }),
      "base64_pk"
    );

    const payload = signLicenseKeyMock.mock.calls[0][0];
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("rejects invalid email", async () => {
    getWebEnvMock.mockImplementation((key: string) => {
      if (key === "RADARBOARD_API_SECRET") return "my-secret";
      if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return "base64_pk";
      return undefined;
    });

    const res = await POST(
      makeRequest({ email: "not-an-email", plan: "pro" }, { Authorization: "Bearer my-secret" })
    );

    expect(res.status).toBe(400);
  });

  it("rejects invalid plan", async () => {
    getWebEnvMock.mockImplementation((key: string) => {
      if (key === "RADARBOARD_API_SECRET") return "my-secret";
      if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return "base64_pk";
      return undefined;
    });

    const res = await POST(
      makeRequest({ email: "user@test.com", plan: "free" }, { Authorization: "Bearer my-secret" })
    );

    expect(res.status).toBe(400);
  });

  it("uses default durationDays when not provided", async () => {
    getWebEnvMock.mockImplementation((key: string) => {
      if (key === "RADARBOARD_API_SECRET") return "my-secret";
      if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return "base64_pk";
      return undefined;
    });
    signLicenseKeyMock.mockReturnValue("token");

    await POST(
      makeRequest(
        { email: "user@test.com", plan: "enterprise" },
        { Authorization: "Bearer my-secret" }
      )
    );

    const payload = signLicenseKeyMock.mock.calls[0][0];
    // Default is 36500 days
    const expectedDuration = 36500 * 86400;
    expect(payload.exp - payload.iat).toBe(expectedDuration);
  });

  it("returns 500 when signing throws", async () => {
    getWebEnvMock.mockImplementation((key: string) => {
      if (key === "RADARBOARD_API_SECRET") return "my-secret";
      if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return "base64_pk";
      return undefined;
    });
    signLicenseKeyMock.mockImplementation(() => {
      throw new Error("Invalid key format");
    });

    const res = await POST(
      makeRequest(validPayload, {
        Authorization: "Bearer my-secret",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to issue license key");
  });
});
