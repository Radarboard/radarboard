import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRepo = {
  getWebhookEndpoints: vi.fn(),
  insertDelivery: vi.fn(),
};

vi.mock("@/data/core/repository", () => ({
  getNotificationRepo: () => mockRepo,
}));

vi.mock("@/lib/notification-glob", () => ({
  matchesAnyNotificationGlob: (type: string, events: string[]) =>
    events.some((e) => type === e || e === "*"),
}));

const fetchMock = vi.fn();

import {
  deliverWebhookDigest,
  deliverWebhookEvent,
  sendTestWebhook,
} from "../notification-webhooks";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

const baseEndpoint = {
  id: "wh1",
  name: "Slack Hook",
  url: "https://notify.example.test/ingest",
  secret: "super-secret-key-1234567890",
  events: ["deploy.success"],
  enabled: true,
  createdAt: 1700000000,
};

describe("deliverWebhookEvent", () => {
  it("delivers to matching enabled endpoints with HMAC signature", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([baseEndpoint]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await deliverWebhookEvent({
      id: "evt-1",
      source: "vercel",
      type: "deploy.success",
      severity: "info",
      title: "Deploy succeeded",
      body: null,
      metadata: {},
      projectSlug: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://notify.example.test/ingest");
    expect(opts.method).toBe("POST");
    expect(opts.headers["X-Radarboard-Event"]).toBe("deploy.success");
    expect(opts.headers["X-Radarboard-Signature"]).toMatch(/^sha256=[a-f0-9]+$/);
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const payload = JSON.parse(opts.body);
    expect(payload.id).toBe("evt-1");
    expect(payload.kind).toBe("event");
    expect(payload.title).toBe("Deploy succeeded");
  });

  it("skips disabled endpoints", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([{ ...baseEndpoint, enabled: false }]);

    await deliverWebhookEvent({
      id: "evt-2",
      source: "vercel",
      type: "deploy.success",
      severity: "info",
      title: "Deploy",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips non-matching event types", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([baseEndpoint]);

    await deliverWebhookEvent({
      id: "evt-3",
      source: "sentry",
      type: "error.spike",
      severity: "critical",
      title: "Error spike",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records failed delivery when endpoint returns non-OK", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([baseEndpoint]);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    mockRepo.insertDelivery.mockResolvedValue(undefined);

    await deliverWebhookEvent({
      id: "evt-4",
      source: "vercel",
      type: "deploy.success",
      severity: "info",
      title: "Deploy",
    });

    expect(mockRepo.insertDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        metadata: expect.objectContaining({ httpStatus: 500 }),
      })
    );
  });

  it("records failed delivery on network error", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([baseEndpoint]);
    fetchMock.mockRejectedValue(new Error("Connection refused"));
    mockRepo.insertDelivery.mockResolvedValue(undefined);

    await deliverWebhookEvent({
      id: "evt-5",
      source: "vercel",
      type: "deploy.success",
      severity: "info",
      title: "Deploy",
    });

    expect(mockRepo.insertDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        metadata: expect.objectContaining({ error: "Connection refused" }),
      })
    );
  });

  it("delivers to multiple matching endpoints in parallel", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([
      { ...baseEndpoint, id: "wh1", events: ["*"] },
      { ...baseEndpoint, id: "wh2", url: "https://other.com/hook", events: ["*"] },
    ]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await deliverWebhookEvent({
      id: "evt-6",
      source: "github",
      type: "push",
      severity: "info",
      title: "Push",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("deliverWebhookDigest", () => {
  it("includes digest-specific fields in payload", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([{ ...baseEndpoint, events: ["*"] }]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await deliverWebhookDigest({
      id: "dig-1",
      source: "system",
      type: "daily.digest",
      severity: "info",
      title: "Daily digest",
      body: null,
      metadata: {},
      projectSlug: null,
      createdAt: 1700000000,
      eventCount: 15,
      windowStart: 1699913600,
      windowEnd: 1700000000,
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.kind).toBe("digest");
    expect(payload.eventCount).toBe(15);
    expect(payload.windowStart).toBe(1699913600);
    expect(payload.windowEnd).toBe(1700000000);
  });
});

describe("sendTestWebhook", () => {
  it("returns error when notification repo is unavailable", async () => {
    // Temporarily override to return null
    const origMock = vi.fn().mockReturnValue(null);
    const mod = await import("@/data/core/repository");
    const origGetNotificationRepo = (mod as { getNotificationRepo: () => unknown })
      .getNotificationRepo;
    (mod as { getNotificationRepo: () => unknown }).getNotificationRepo = origMock;

    const result = await sendTestWebhook("wh1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not supported/i);

    // Restore
    (mod as { getNotificationRepo: () => unknown }).getNotificationRepo = origGetNotificationRepo;
  });

  it("returns error when endpoint not found", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([]);

    const result = await sendTestWebhook("nonexistent");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("sends test webhook and returns success", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([baseEndpoint]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await sendTestWebhook("wh1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.endpointName).toBe("Slack Hook");

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.type).toBe("notification.test");
    expect(payload.source).toBe("radarboard");
  });

  it("returns error on failed test delivery", async () => {
    mockRepo.getWebhookEndpoints.mockResolvedValue([baseEndpoint]);
    fetchMock.mockRejectedValue(new Error("Connection timeout"));

    const result = await sendTestWebhook("wh1");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Connection timeout");
  });
});
