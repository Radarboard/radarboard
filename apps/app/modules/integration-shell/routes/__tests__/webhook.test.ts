import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations-init", () => ({}));

const mockWebhookHandler = {
  verifySignature: vi.fn(),
  parsePayload: vi.fn(),
};

const { INTEGRATION_REGISTRY_MOCK } = vi.hoisted(() => ({
  INTEGRATION_REGISTRY_MOCK: new Map(),
}));

vi.mock("@radarboard/integration-sdk/registry", () => ({
  INTEGRATION_REGISTRY: INTEGRATION_REGISTRY_MOCK,
}));

const mockCredRepo = { getCredential: vi.fn() };

vi.mock("@/db/repository", () => ({
  getCredentialRepo: () => mockCredRepo,
}));

vi.mock("@/lib/debug-events", () => ({
  emitDebugEvent: vi.fn(),
}));

vi.mock("@/lib/integration-artifacts", () => ({
  persistIntegrationArtifacts: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  emitNotificationEvents: vi.fn(),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleIntegrationWebhook as POST } from "@/modules/integration-shell/routes/webhook";

beforeEach(() => {
  vi.clearAllMocks();
  INTEGRATION_REGISTRY_MOCK.clear();
});

function callPOST(integration: string, body = "{}") {
  return POST(
    new Request(`http://localhost/api/webhooks/${integration}`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    }),
    integration
  );
}

describe("POST /api/integrations/[integration]/webhook", () => {
  it("returns 404 for unknown integration", async () => {
    const res = await callPOST("nonexistent");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/Unknown/);
  });

  it("returns 401 when webhook secret is not configured", async () => {
    INTEGRATION_REGISTRY_MOCK.set("github", {
      webhookHandler: mockWebhookHandler,
    });
    mockCredRepo.getCredential.mockResolvedValue(null);

    const res = await callPOST("github");
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/secret not configured/i);
  });

  it("returns 401 when signature verification fails", async () => {
    INTEGRATION_REGISTRY_MOCK.set("github", {
      webhookHandler: mockWebhookHandler,
    });
    mockCredRepo.getCredential.mockResolvedValue({ secret: "wh_secret_123" });
    mockWebhookHandler.verifySignature.mockResolvedValue(false);

    const res = await callPOST("github", '{"action":"push"}');
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/Invalid signature/);
  });

  it("returns 400 when payload parsing fails", async () => {
    INTEGRATION_REGISTRY_MOCK.set("github", {
      webhookHandler: mockWebhookHandler,
    });
    mockCredRepo.getCredential.mockResolvedValue({ secret: "wh_secret_123" });
    mockWebhookHandler.verifySignature.mockResolvedValue(true);
    mockWebhookHandler.parsePayload.mockRejectedValue(new Error("Malformed payload"));

    const res = await callPOST("github", "bad payload");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Failed to parse/);
  });

  it("processes valid webhook and returns event count", async () => {
    INTEGRATION_REGISTRY_MOCK.set("github", {
      webhookHandler: mockWebhookHandler,
    });
    mockCredRepo.getCredential.mockResolvedValue({ secret: "wh_secret_123" });
    mockWebhookHandler.verifySignature.mockResolvedValue(true);
    mockWebhookHandler.parsePayload.mockResolvedValue([
      { type: "push", data: {} },
      { type: "push", data: {} },
    ]);

    const res = await callPOST("github", '{"action":"push"}');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.eventCount).toBe(2);
  });

  it("handles integration with no webhookHandler", async () => {
    INTEGRATION_REGISTRY_MOCK.set("slack", { webhookHandler: undefined });

    const res = await callPOST("slack");
    expect(res.status).toBe(404);
  });
});
