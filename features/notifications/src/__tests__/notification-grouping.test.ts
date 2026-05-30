import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { describe, expect, it } from "vitest";
import { groupNotifications } from "../utils/notification-grouping";

function makeItem(overrides: Partial<NotificationFeedItem> = {}): NotificationFeedItem {
  return {
    deliveryId: crypto.randomUUID(),
    recordType: "event",
    notificationId: crypto.randomUUID(),
    source: "betterstack",
    type: "monitor.down",
    severity: "critical",
    projectSlug: null,
    title: "Monitor down",
    body: null,
    metadata: {},
    occurredAt: Math.floor(Date.now() / 1000),
    createdAt: Math.floor(Date.now() / 1000),
    eventCount: null,
    status: "delivered",
    channel: "in_app",
    deliveredAt: Math.floor(Date.now() / 1000),
    readAt: null,
    ...overrides,
  } as NotificationFeedItem;
}

describe("groupNotifications", () => {
  it("returns empty array for no notifications", () => {
    expect(groupNotifications([])).toEqual([]);
  });

  it("groups items from same source within time window", () => {
    const now = Math.floor(Date.now() / 1000);
    const items = [
      makeItem({ source: "betterstack", occurredAt: now }),
      makeItem({ source: "betterstack", occurredAt: now - 60 }), // 1 min ago
      makeItem({ source: "betterstack", occurredAt: now - 120 }), // 2 min ago
    ];
    const groups = groupNotifications(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(3);
    expect(groups[0]?.source).toBe("betterstack");
  });

  it("splits groups when source changes", () => {
    const now = Math.floor(Date.now() / 1000);
    const items = [
      makeItem({ source: "betterstack", occurredAt: now }),
      makeItem({ source: "sentry", occurredAt: now - 30 }),
      makeItem({ source: "betterstack", occurredAt: now - 60 }),
    ];
    const groups = groupNotifications(items);
    expect(groups).toHaveLength(3);
  });

  it("splits groups when time window exceeded", () => {
    const now = Math.floor(Date.now() / 1000);
    const items = [
      makeItem({ source: "betterstack", occurredAt: now }),
      makeItem({ source: "betterstack", occurredAt: now - 600 }), // 10 min ago (> 5 min window)
    ];
    const groups = groupNotifications(items);
    expect(groups).toHaveLength(2);
  });

  it("preserves single items as groups with count 1", () => {
    const items = [makeItem({ source: "sentry" })];
    const groups = groupNotifications(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(1);
  });

  it("representative is the first (most recent) item", () => {
    const now = Math.floor(Date.now() / 1000);
    const newest = makeItem({ source: "betterstack", occurredAt: now, title: "Newest" });
    const older = makeItem({ source: "betterstack", occurredAt: now - 60, title: "Older" });
    const groups = groupNotifications([newest, older]);
    expect(groups[0]?.representative.title).toBe("Newest");
  });
});
