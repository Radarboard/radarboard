import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAccumulatorAdd,
  mockNotificationEmit,
  mockStreamPublish,
  mockSetInterval,
  mockIsDuplicate,
  mockGetActiveSnoozes,
  mockGetPreference,
  mockGetRules,
  mockInsertEvent,
  mockGetRoutingConfig,
} = vi.hoisted(() => ({
  mockAccumulatorAdd: vi.fn(),
  mockNotificationEmit: vi.fn(),
  mockStreamPublish: vi.fn(),
  mockSetInterval: vi.fn(() => 0 as unknown as ReturnType<typeof setInterval>),
  mockIsDuplicate: vi.fn(),
  mockGetActiveSnoozes: vi.fn(),
  mockGetPreference: vi.fn(),
  mockGetRules: vi.fn(),
  mockInsertEvent: vi.fn(),
  mockGetRoutingConfig: vi.fn(),
}));

vi.stubGlobal("setInterval", mockSetInterval);

vi.mock("@radarboard/notifications/accumulator", () => ({
  DigestAccumulator: class {
    add = mockAccumulatorAdd;
    tick = vi.fn();
  },
}));

vi.mock("@radarboard/notifications/event-bus", () => ({
  notificationEventBus: {
    emit: mockNotificationEmit,
  },
}));

vi.mock("@radarboard/notifications/stream-hub", () => ({
  notificationStreamHub: {
    publish: mockStreamPublish,
  },
}));

vi.mock("@/lib/notifications/notification-webhooks", () => ({
  deliverWebhookEvent: vi.fn(),
  deliverWebhookDigest: vi.fn(),
}));

vi.mock("@/data/core/repository", () => ({
  getNotificationRepo: () => ({
    isDuplicate: mockIsDuplicate,
    getActiveSnoozes: mockGetActiveSnoozes,
    getPreference: mockGetPreference,
    getRules: mockGetRules,
    insertEvent: mockInsertEvent,
    getUnreadCount: vi.fn(),
    insertDelivery: vi.fn(),
    insertDigest: vi.fn(),
    assignEventsToDigest: vi.fn(),
  }),
  getSettingsRepo: () => ({
    getRoutingConfig: mockGetRoutingConfig,
  }),
}));

import { emitNotificationEvent } from "../notifications";

beforeEach(() => {
  vi.clearAllMocks();

  mockSetInterval.mockClear();
  mockIsDuplicate.mockResolvedValue(false);
  mockGetActiveSnoozes.mockResolvedValue([]);
  mockGetRules.mockResolvedValue([]);
  mockInsertEvent.mockResolvedValue(undefined);
  mockGetRoutingConfig.mockResolvedValue({ rules: [] });
  mockGetPreference.mockImplementation(async (id: string) => {
    if (id === "global") {
      return {
        id: "global",
        enabled: true,
        preset: "all",
        digestWindow: 300,
        channels: ["in_app"],
        quietHours: null,
        updatedAt: 1,
      };
    }

    return null;
  });
});

describe("emitNotificationEvent shared routing", () => {
  it("suppresses events when a routing rule denies notifications", async () => {
    mockGetRoutingConfig.mockResolvedValue({
      rules: [
        {
          id: "deny-deploys",
          name: "Deny deploy notifications",
          enabled: true,
          source: "github",
          eventType: "pr.merged",
          severity: null,
          projectSlug: null,
          condition: null,
          notifications: "deny",
          ticker: "inherit",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await emitNotificationEvent({
      source: "github",
      sourceEventId: "github:pr:1:merged",
      type: "pr.merged",
      severity: "info",
      title: "PR merged",
    });

    expect(mockInsertEvent).not.toHaveBeenCalled();
    expect(mockAccumulatorAdd).not.toHaveBeenCalled();
  });

  it("restores pref channels when routing allows an event blocked by a broad preset", async () => {
    mockGetPreference.mockImplementation(async (id: string) => {
      if (id === "global") {
        return {
          id: "global",
          enabled: true,
          preset: "critical_only",
          digestWindow: 300,
          channels: ["in_app"],
          quietHours: null,
          updatedAt: 1,
        };
      }

      return null;
    });

    mockGetRoutingConfig.mockResolvedValue({
      rules: [
        {
          id: "allow-github-merged-prs",
          name: "Allow merged PR notifications",
          enabled: true,
          source: "github",
          eventType: "pr.merged",
          severity: null,
          projectSlug: null,
          condition: null,
          notifications: "allow",
          ticker: "inherit",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await emitNotificationEvent({
      source: "github",
      sourceEventId: "github:pr:2:merged",
      type: "pr.merged",
      severity: "info",
      title: "PR merged",
    });

    expect(mockInsertEvent).toHaveBeenCalledTimes(1);
    expect(mockAccumulatorAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "github",
        type: "pr.merged",
      }),
      300_000,
      ["in_app"],
      "in_app"
    );
  });

  it("does not bypass quiet hours when routing allows notifications", async () => {
    mockGetPreference.mockImplementation(async (id: string) => {
      if (id === "global") {
        return {
          id: "global",
          enabled: true,
          preset: "all",
          digestWindow: 300,
          channels: ["in_app"],
          quietHours: {
            start: "00:00",
            end: "00:00",
            timezone: "UTC",
          },
          updatedAt: 1,
        };
      }

      return null;
    });

    mockGetRoutingConfig.mockResolvedValue({
      rules: [
        {
          id: "allow-github-merged-prs",
          name: "Allow merged PR notifications",
          enabled: true,
          source: "github",
          eventType: "pr.merged",
          severity: null,
          projectSlug: null,
          condition: null,
          notifications: "allow",
          ticker: "inherit",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await emitNotificationEvent({
      source: "github",
      sourceEventId: "github:pr:3:merged",
      type: "pr.merged",
      severity: "info",
      title: "PR merged",
    });

    expect(mockInsertEvent).not.toHaveBeenCalled();
    expect(mockAccumulatorAdd).not.toHaveBeenCalled();
  });
});
