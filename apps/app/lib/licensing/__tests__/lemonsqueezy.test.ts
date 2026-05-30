import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// Mock the logger to avoid side effects
vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { mapVariantToPlan, resolveSubscriptionPlan, verifyWebhookSignature } from "../lemonsqueezy";

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test_secret_key";
  const payload = JSON.stringify({ event: "subscription_created", data: { id: "123" } });

  function computeValidSignature(body: string, key: string): string {
    return createHmac("sha256", key).update(body).digest("hex");
  }

  it("returns true for a valid signature", () => {
    const signature = computeValidSignature(payload, secret);
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    expect(verifyWebhookSignature(payload, "deadbeef", secret)).toBe(false);
  });

  it("returns false when payload has been tampered with", () => {
    const signature = computeValidSignature(payload, secret);
    const tampered = payload.replace("123", "456");
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
  });

  it("returns false when secret is wrong", () => {
    const signature = computeValidSignature(payload, secret);
    expect(verifyWebhookSignature(payload, signature, "wrong-secret")).toBe(false);
  });

  it("handles empty payload", () => {
    const signature = computeValidSignature("", secret);
    expect(verifyWebhookSignature("", signature, secret)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapVariantToPlan
// ---------------------------------------------------------------------------

describe("mapVariantToPlan", () => {
  it("returns pro when variant matches proVariantId", () => {
    expect(mapVariantToPlan(12345, "12345")).toBe("pro");
  });

  it("returns free when variant does not match proVariantId", () => {
    expect(mapVariantToPlan(99999, "12345")).toBe("free");
  });

  it("returns free when proVariantId is undefined", () => {
    expect(mapVariantToPlan(12345, undefined)).toBe("free");
  });

  it("returns free when proVariantId is empty string", () => {
    expect(mapVariantToPlan(12345, "")).toBe("free");
  });

  it("handles string-to-number coercion for variant comparison", () => {
    // proVariantId is a string from env vars, variantId is a number from the API
    expect(mapVariantToPlan(42, "42")).toBe("pro");
    expect(mapVariantToPlan(42, "043")).toBe("free");
  });
});

// ---------------------------------------------------------------------------
// resolveSubscriptionPlan
// ---------------------------------------------------------------------------

describe("resolveSubscriptionPlan", () => {
  describe("statuses that keep the current plan", () => {
    it("active subscription keeps plan", () => {
      expect(resolveSubscriptionPlan("active", "pro")).toBe("pro");
      expect(resolveSubscriptionPlan("active", "enterprise")).toBe("enterprise");
    });

    it("on_trial subscription keeps plan", () => {
      expect(resolveSubscriptionPlan("on_trial", "pro")).toBe("pro");
    });

    it("cancelled subscription keeps plan (active until period ends)", () => {
      expect(resolveSubscriptionPlan("cancelled", "pro")).toBe("pro");
    });

    it("past_due subscription keeps plan (grace period)", () => {
      expect(resolveSubscriptionPlan("past_due", "pro")).toBe("pro");
    });
  });

  describe("statuses that downgrade to free", () => {
    it("paused subscription downgrades to free", () => {
      expect(resolveSubscriptionPlan("paused", "pro")).toBe("free");
    });

    it("unpaid subscription downgrades to free", () => {
      expect(resolveSubscriptionPlan("unpaid", "pro")).toBe("free");
    });

    it("expired subscription downgrades to free", () => {
      expect(resolveSubscriptionPlan("expired", "pro")).toBe("free");
    });
  });

  describe("unknown statuses", () => {
    it("unknown status defaults to free", () => {
      // Cast to bypass TypeScript type checking for the unknown status test
      expect(resolveSubscriptionPlan("something_new" as any, "pro")).toBe("free");
    });
  });
});
