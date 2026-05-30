import type { SettingsRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getSettingsRepo: vi.fn(),
}));

const validateLicenseKeyFullMock = vi.fn();
const getPlanFromLicenseKeyMock = vi.fn();

vi.mock("@/lib/license", () => ({
  validateLicenseKeyFull: (...args: unknown[]) => validateLicenseKeyFullMock(...args),
  getPlanFromLicenseKey: (...args: unknown[]) => getPlanFromLicenseKeyMock(...args),
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

import { getSettingsRepo } from "@/db/repository";
import {
  handleRemoveLicense as DELETE,
  handleGetLicense as GET,
  handleActivateLicense as POST,
} from "@/modules/settings-shell/license";

const mockRepo: Record<
  "getLicenseKey" | "setLicenseKey" | "setUserPlan",
  ReturnType<typeof vi.fn>
> = {
  getLicenseKey: vi.fn(),
  setLicenseKey: vi.fn(),
  setUserPlan: vi.fn(),
};

beforeEach(() => {
  for (const fn of Object.values(mockRepo)) fn.mockReset();
  validateLicenseKeyFullMock.mockReset();
  getPlanFromLicenseKeyMock.mockReset();
  vi.mocked(getSettingsRepo).mockReturnValue(mockRepo as unknown as SettingsRepository);
});

/* ------------------------------------------------------------------ */
/*  GET /api/license                                                   */
/* ------------------------------------------------------------------ */
describe("GET /api/license", () => {
  it("returns inactive when no license key stored", async () => {
    mockRepo.getLicenseKey.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ active: false, plan: null });
  });

  it("returns active license details when key is valid", async () => {
    mockRepo.getLicenseKey.mockResolvedValue("LK_valid_key");
    validateLicenseKeyFullMock.mockResolvedValue({
      valid: true,
      payload: { plan: "pro", email: "user@test.com", exp: 1700000000 },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.active).toBe(true);
    expect(body.plan).toBe("pro");
    expect(body.email).toBe("user@test.com");
    expect(body.expiresAt).toBe(1700000000);
    expect(body.error).toBeNull();
  });

  it("returns inactive with error when key is invalid", async () => {
    mockRepo.getLicenseKey.mockResolvedValue("LK_expired");
    validateLicenseKeyFullMock.mockResolvedValue({
      valid: false,
      error: "License expired",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.active).toBe(false);
    expect(body.error).toBe("License expired");
  });

  it("returns 500 on repo error", async () => {
    mockRepo.getLicenseKey.mockRejectedValue(new Error("DB down"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to get license status");
  });
});

/* ------------------------------------------------------------------ */
/*  POST /api/license                                                  */
/* ------------------------------------------------------------------ */
describe("POST /api/license", () => {
  function makeRequest(payload: unknown): Request {
    return new Request("http://localhost/api/license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  it("activates a valid license key", async () => {
    validateLicenseKeyFullMock.mockResolvedValue({
      valid: true,
      payload: { plan: "pro", email: "user@test.com", exp: 1700000000 },
    });
    getPlanFromLicenseKeyMock.mockReturnValue("pro");
    mockRepo.setLicenseKey.mockResolvedValue(undefined);
    mockRepo.setUserPlan.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ licenseKey: "LK_valid_key" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.plan).toBe("pro");
    expect(body.email).toBe("user@test.com");
    expect(mockRepo.setLicenseKey).toHaveBeenCalledWith("LK_valid_key");
    expect(mockRepo.setUserPlan).toHaveBeenCalledWith("pro");
  });

  it("returns 400 for invalid license key", async () => {
    validateLicenseKeyFullMock.mockResolvedValue({
      valid: false,
      error: "Invalid key format",
    });

    const res = await POST(makeRequest({ licenseKey: "BAD_KEY" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid key format");
  });

  it("rejects empty license key", async () => {
    const res = await POST(makeRequest({ licenseKey: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing license key", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("does not set plan when getPlanFromLicenseKey returns null", async () => {
    validateLicenseKeyFullMock.mockResolvedValue({
      valid: true,
      payload: { plan: "custom", email: "user@test.com" },
    });
    getPlanFromLicenseKeyMock.mockReturnValue(null);
    mockRepo.setLicenseKey.mockResolvedValue(undefined);

    await POST(makeRequest({ licenseKey: "LK_custom" }));

    expect(mockRepo.setLicenseKey).toHaveBeenCalledWith("LK_custom");
    expect(mockRepo.setUserPlan).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    validateLicenseKeyFullMock.mockResolvedValue({
      valid: true,
      payload: { plan: "pro" },
    });
    getPlanFromLicenseKeyMock.mockReturnValue("pro");
    mockRepo.setLicenseKey.mockRejectedValue(new Error("DB write failed"));

    const res = await POST(makeRequest({ licenseKey: "LK_valid" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to activate license");
  });
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/license                                                */
/* ------------------------------------------------------------------ */
describe("DELETE /api/license", () => {
  it("removes license and resets to free plan", async () => {
    mockRepo.setLicenseKey.mockResolvedValue(undefined);
    mockRepo.setUserPlan.mockResolvedValue(undefined);

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRepo.setLicenseKey).toHaveBeenCalledWith("");
    expect(mockRepo.setUserPlan).toHaveBeenCalledWith("free");
  });

  it("returns 500 on repo error", async () => {
    mockRepo.setLicenseKey.mockRejectedValue(new Error("DB down"));

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to remove license");
  });
});
