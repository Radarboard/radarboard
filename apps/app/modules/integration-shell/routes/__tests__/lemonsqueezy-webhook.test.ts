import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebEnvMock = vi.fn();
const verifyWebhookSignatureMock = vi.fn();
const mapVariantToPlanMock = vi.fn();
const resolveSubscriptionPlanMock = vi.fn();
const signLicenseKeyMock = vi.fn();
const sendLicenseKeyEmailMock = vi.fn();

const mockSettingsRepo = {
  setLicenseKey: vi.fn(),
  setUserPlan: vi.fn(),
};

vi.mock("@/lib/env", () => ({
  getWebEnv: (...args: unknown[]) => getWebEnvMock(...args),
}));

vi.mock("@/lib/lemonsqueezy", () => ({
  verifyWebhookSignature: (...args: unknown[]) => verifyWebhookSignatureMock(...args),
  mapVariantToPlan: (...args: unknown[]) => mapVariantToPlanMock(...args),
  resolveSubscriptionPlan: (...args: unknown[]) => resolveSubscriptionPlanMock(...args),
}));

vi.mock("@/lib/license-crypto", () => ({
  signLicenseKey: (...args: unknown[]) => signLicenseKeyMock(...args),
}));

vi.mock("@/lib/license-email", () => ({
  sendLicenseKeyEmail: (...args: unknown[]) => sendLicenseKeyEmailMock(...args),
}));

vi.mock("@/db/repository", () => ({
  getSettingsRepo: () => mockSettingsRepo,
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleLemonSqueezyWebhook as POST } from "@/modules/integration-shell/routes/lemonsqueezy-webhook";

beforeEach(() => {
  vi.clearAllMocks();
  getWebEnvMock.mockImplementation((key: string) => {
    if (key === "LEMONSQUEEZY_WEBHOOK_SECRET") return "wh_secret";
    if (key === "RADARBOARD_LICENSE_PRIVATE_KEY") return "base64_pk";
    if (key === "LEMONSQUEEZY_PRO_VARIANT_ID") return "variant_pro";
    return undefined;
  });
  verifyWebhookSignatureMock.mockReturnValue(true);
});

function makeRequest(event: unknown): Request {
  const body = JSON.stringify(event);
  return new Request("http://localhost/api/webhooks/lemonsqueezy", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "x-signature": "valid_sig",
    },
  });
}

const orderEvent = {
  meta: { event_name: "order_created" },
  data: {
    id: "order-1",
    attributes: {
      user_email: "buyer@test.com",
      variant_id: "variant_pro",
    },
  },
};

const subscriptionEvent = {
  meta: { event_name: "subscription_created" },
  data: {
    id: "sub-1",
    attributes: {
      user_email: "user@test.com",
      variant_id: "variant_pro",
      status: "active",
    },
  },
};

describe("POST /api/integrations/lemonsqueezy/webhook", () => {
  it("returns 500 when webhook secret is not configured", async () => {
    getWebEnvMock.mockReturnValue(undefined);

    const res = await POST(makeRequest(orderEvent));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/not configured/);
  });

  it("returns 401 when signature is invalid", async () => {
    verifyWebhookSignatureMock.mockReturnValue(false);

    const res = await POST(makeRequest(orderEvent));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/Invalid signature/);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/webhooks/lemonsqueezy", {
      method: "POST",
      body: "not json{{{",
      headers: { "x-signature": "sig" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("issues license key on order_created for pro variant", async () => {
    mapVariantToPlanMock.mockReturnValue("pro");
    signLicenseKeyMock.mockReturnValue("eyJ.license.key");
    sendLicenseKeyEmailMock.mockResolvedValue(undefined);

    const res = await POST(makeRequest(orderEvent));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mockSettingsRepo.setLicenseKey).toHaveBeenCalledWith("eyJ.license.key");
    expect(mockSettingsRepo.setUserPlan).toHaveBeenCalledWith("pro");
    expect(sendLicenseKeyEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@test.com",
        licenseKey: "eyJ.license.key",
        plan: "pro",
      })
    );
  });

  it("skips license generation for free variant orders", async () => {
    mapVariantToPlanMock.mockReturnValue("free");

    const res = await POST(makeRequest(orderEvent));

    expect(res.status).toBe(200);
    expect(signLicenseKeyMock).not.toHaveBeenCalled();
    expect(mockSettingsRepo.setLicenseKey).not.toHaveBeenCalled();
  });

  it("updates plan on subscription_created", async () => {
    mapVariantToPlanMock.mockReturnValue("pro");
    resolveSubscriptionPlanMock.mockReturnValue("pro");

    const res = await POST(makeRequest(subscriptionEvent));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mockSettingsRepo.setUserPlan).toHaveBeenCalledWith("pro");
  });

  it("downgrades to free on subscription_expired", async () => {
    const expiredEvent = {
      meta: { event_name: "subscription_expired" },
      data: { id: "sub-1", attributes: {} },
    };

    const res = await POST(makeRequest(expiredEvent));

    expect(res.status).toBe(200);
    expect(mockSettingsRepo.setUserPlan).toHaveBeenCalledWith("free");
  });

  it("handles unrecognized events gracefully", async () => {
    const unknownEvent = {
      meta: { event_name: "invoice_paid" },
      data: { id: "inv-1", attributes: {} },
    };

    const res = await POST(makeRequest(unknownEvent));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
  });

  it("returns 500 when processing throws", async () => {
    mapVariantToPlanMock.mockReturnValue("pro");
    signLicenseKeyMock.mockImplementation(() => {
      throw new Error("Signing failed");
    });

    const res = await POST(makeRequest(orderEvent));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Processing failed");
  });
});
