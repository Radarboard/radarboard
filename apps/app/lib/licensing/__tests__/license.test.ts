import { describe, expect, it, vi } from "vitest";
import { getWebEnv } from "@/lib/env";

// Mock env and license-crypto before importing
vi.mock("@/lib/env", () => ({
  getWebEnv: vi.fn(() => undefined),
}));

vi.mock("../license-crypto", () => ({
  verifyLicenseSignature: vi.fn(),
}));

import { getPlanFromLicenseKey, validateLicenseKey, validateLicenseKeyFull } from "../license";
import { verifyLicenseSignature } from "../license-crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake JWT-like token with the given payload. */
function buildToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const fakeSig = btoa("fake-signature");
  return `${header}.${body}.${fakeSig}`;
}

/** Build a valid payload with future expiry. */
function validPayload() {
  return {
    plan: "pro",
    email: "user@example.com",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // +1 day
  };
}

// ---------------------------------------------------------------------------
// validateLicenseKey (structural, synchronous)
// ---------------------------------------------------------------------------

describe("validateLicenseKey", () => {
  it("validates a well-formed token with valid fields", () => {
    const token = buildToken(validPayload());
    const result = validateLicenseKey(token);
    expect(result.valid).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload?.plan).toBe("pro");
    expect(result.payload?.email).toBe("user@example.com");
  });

  it("accepts all valid plan tiers", () => {
    for (const plan of ["free", "pro", "enterprise"] as const) {
      const token = buildToken({ ...validPayload(), plan });
      const result = validateLicenseKey(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.plan).toBe(plan);
    }
  });

  it("rejects token without 3 parts", () => {
    expect(validateLicenseKey("only-one-part").valid).toBe(false);
    expect(validateLicenseKey("two.parts").valid).toBe(false);
    expect(validateLicenseKey("a.b.c.d").valid).toBe(false);
    expect(validateLicenseKey("").valid).toBe(false);
  });

  it("rejects token with missing required fields", () => {
    // Missing plan
    const noPlan = buildToken({ email: "a@b.com", exp: 9999999999, iat: 1 });
    expect(validateLicenseKey(noPlan).valid).toBe(false);
    expect(validateLicenseKey(noPlan).error).toContain("missing required fields");

    // Missing email
    const noEmail = buildToken({ plan: "pro", exp: 9999999999, iat: 1 });
    expect(validateLicenseKey(noEmail).valid).toBe(false);

    // Missing exp
    const noExp = buildToken({ plan: "pro", email: "a@b.com", iat: 1 });
    expect(validateLicenseKey(noExp).valid).toBe(false);
  });

  it("rejects token with invalid plan tier", () => {
    const token = buildToken({ ...validPayload(), plan: "platinum" });
    const result = validateLicenseKey(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid plan");
  });

  it("rejects expired tokens", () => {
    const payload = {
      ...validPayload(),
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    };
    const token = buildToken(payload);
    const result = validateLicenseKey(token);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("rejects tokens with non-JSON payload", () => {
    const header = btoa("{}");
    const body = btoa("not-json");
    const sig = btoa("sig");
    const result = validateLicenseKey(`${header}.${body}.${sig}`);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Failed to decode");
  });
});

// ---------------------------------------------------------------------------
// validateLicenseKeyFull (async, crypto)
// ---------------------------------------------------------------------------

describe("validateLicenseKeyFull", () => {
  it("falls back to structural validation when no public key is set", async () => {
    const token = buildToken(validPayload());
    const result = await validateLicenseKeyFull(token);
    // No public key set (mocked getWebEnv returns undefined)
    // Should fall back to structural validation
    expect(result.valid).toBe(true);
    expect(result.payload?.plan).toBe("pro");
  });

  it("calls verifyLicenseSignature when public key is configured", async () => {
    vi.mocked(getWebEnv).mockReturnValue("base64-public-key");
    vi.mocked(verifyLicenseSignature).mockResolvedValue({
      valid: true,
      payload: validPayload() as any,
    });

    const token = buildToken(validPayload());
    const result = await validateLicenseKeyFull(token);

    expect(verifyLicenseSignature).toHaveBeenCalledWith(token, "base64-public-key");
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPlanFromLicenseKey
// ---------------------------------------------------------------------------

describe("getPlanFromLicenseKey", () => {
  it("returns null for null key", () => {
    expect(getPlanFromLicenseKey(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getPlanFromLicenseKey("")).toBeNull();
  });

  it("returns null for invalid key", () => {
    expect(getPlanFromLicenseKey("not-a-valid-key")).toBeNull();
  });

  it("returns null for expired key", () => {
    const payload = {
      ...validPayload(),
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const token = buildToken(payload);
    expect(getPlanFromLicenseKey(token)).toBeNull();
  });

  it("returns plan for valid key", () => {
    const token = buildToken(validPayload());
    expect(getPlanFromLicenseKey(token)).toBe("pro");
  });

  it("returns correct plan tier for enterprise key", () => {
    const token = buildToken({ ...validPayload(), plan: "enterprise" });
    expect(getPlanFromLicenseKey(token)).toBe("enterprise");
  });

  it("returns correct plan tier for free key", () => {
    const token = buildToken({ ...validPayload(), plan: "free" });
    expect(getPlanFromLicenseKey(token)).toBe("free");
  });
});
