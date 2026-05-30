import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsertEvent = vi.fn();
const mockListEvents = vi.fn();
const mockPruneEvents = vi.fn();
const mockEmitNotificationEvent = vi.fn();
const mockGetDebugConfig = vi.fn();

vi.mock("@/data/core/repository", () => ({
  getDebugRepo: () => ({
    insertEvent: mockInsertEvent,
    listEvents: mockListEvents,
    pruneEvents: mockPruneEvents,
  }),
  getSettingsRepo: () => ({
    getDebugConfig: mockGetDebugConfig,
  }),
}));

vi.mock("@/lib/notifications", () => ({
  emitNotificationEvent: (input: unknown) => mockEmitNotificationEvent(input),
}));

import { emitDebugEvent, resetDebugConfigCacheForTests } from "../debug-events";

beforeEach(() => {
  vi.clearAllMocks();
  resetDebugConfigCacheForTests();
  mockInsertEvent.mockResolvedValue(undefined);
  mockListEvents.mockResolvedValue([]);
  mockPruneEvents.mockResolvedValue(0);
  mockEmitNotificationEvent.mockResolvedValue(null);
  mockGetDebugConfig.mockResolvedValue({});
});

describe("emitDebugEvent", () => {
  it("promotes failed server-side events into notifications", async () => {
    await emitDebugEvent({
      level: "error",
      source: "api/chat",
      eventType: "chat.request.failed",
      message: "Chat request failed",
      requestId: "req-1",
      metadata: { error: "boom" },
    });

    expect(mockInsertEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api/chat",
        type: "chat.request.failed",
        severity: "warning",
        title: "Chat request failed",
      })
    );
  });

  it("does not promote non-severe lifecycle events", async () => {
    await emitDebugEvent({
      level: "info",
      source: "api/chat",
      eventType: "chat.request.started",
      message: "Chat request started",
    });

    expect(mockInsertEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitNotificationEvent).not.toHaveBeenCalled();
  });

  it("uses configured promotion rules", async () => {
    mockGetDebugConfig.mockResolvedValue({
      promotionEnabled: true,
      promotionRules: [
        {
          id: "widget-failures",
          enabled: true,
          sourcePattern: "widget/*",
          eventTypePattern: "*.failed",
          level: "error",
          severity: "critical",
        },
      ],
    });

    await emitDebugEvent({
      level: "error",
      source: "widget/manual",
      eventType: "widget.manual_refresh.failed",
      message: "Widget manual refresh failed",
    });

    expect(mockEmitNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "widget/manual",
        type: "widget.manual_refresh.failed",
        severity: "critical",
      })
    );
  });

  it("redacts sensitive metadata before persistence", async () => {
    await emitDebugEvent({
      level: "error",
      source: "api/chat",
      eventType: "chat.request.failed",
      message: "Chat request failed",
      metadata: {
        authorization: "Bearer secret-token",
        refreshToken: "abc123",
        nested: { clientSecret: "top-secret" },
      },
    });

    const inserted = mockInsertEvent.mock.calls[0]?.[0] as { metadata: string };
    expect(inserted.metadata).toContain("[REDACTED]");
    expect(inserted.metadata).not.toContain("secret-token");
    expect(inserted.metadata).not.toContain("abc123");
    expect(inserted.metadata).not.toContain("top-secret");
  });

  it("caps oversized metadata payloads", async () => {
    mockGetDebugConfig.mockResolvedValue({
      metadataMaxBytes: 256,
    });

    await emitDebugEvent({
      level: "info",
      source: "api/chat",
      eventType: "chat.request.started",
      message: "Chat request started",
      metadata: {
        payload: "x".repeat(5000),
      },
    });

    const inserted = mockInsertEvent.mock.calls[0]?.[0] as { metadata: string };
    expect(inserted.metadata.length).toBeLessThanOrEqual(256);
    expect(inserted.metadata).toContain("__truncated");
  });
});
