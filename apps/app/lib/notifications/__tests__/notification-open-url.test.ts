import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { describe, expect, it } from "vitest";
import { getNotificationOpenUrl } from "../notification-open-url";

function makeItem(overrides: Partial<NotificationFeedItem> = {}): NotificationFeedItem {
  return {
    deliveryId: "d1",
    recordType: "event",
    notificationId: "n1",
    source: "github",
    type: "pr.opened",
    severity: "info",
    projectSlug: null,
    title: "Test",
    body: null,
    metadata: {},
    occurredAt: 1,
    createdAt: 1,
    eventCount: null,
    status: "delivered",
    channel: "in_app",
    deliveredAt: 1,
    readAt: null,
    ...overrides,
  } as NotificationFeedItem;
}

describe("getNotificationOpenUrl", () => {
  it("returns metadata.url when present", () => {
    expect(
      getNotificationOpenUrl(makeItem({ metadata: { url: "https://github.com/o/r/pull/1" } }))
    ).toBe("https://github.com/o/r/pull/1");
  });

  it("returns bare URL from body when metadata has no url", () => {
    expect(
      getNotificationOpenUrl(
        makeItem({
          source: "vercel",
          metadata: {},
          body: "https://my-app.vercel.app",
        })
      )
    ).toBe("https://my-app.vercel.app");
  });

  it("extracts first URL from body text", () => {
    expect(
      getNotificationOpenUrl(
        makeItem({
          source: "vercel",
          body: "See https://x.com/foo for details",
        })
      )
    ).toBe("https://x.com/foo");
  });

  it("falls back to GitHub repo from metadata for github source", () => {
    expect(
      getNotificationOpenUrl(
        makeItem({
          source: "github",
          metadata: { repo: "o/r" },
        })
      )
    ).toBe("https://github.com/o/r");
  });

  it("returns null when nothing matches", () => {
    expect(
      getNotificationOpenUrl(makeItem({ source: "slack", metadata: {}, body: "hello" }))
    ).toBeNull();
  });

  it("finds https URLs nested anywhere in metadata", () => {
    expect(
      getNotificationOpenUrl(
        makeItem({
          source: "future-plugin",
          metadata: { payload: { record: { html_url: "https://example.com/items/99" } } },
        })
      )
    ).toBe("https://example.com/items/99");
  });

  it("uses permalink at top level when provided", () => {
    expect(
      getNotificationOpenUrl(
        makeItem({
          source: "sentry",
          metadata: { issueId: "1", permalink: "https://sentry.io/issues/abc/" },
        })
      )
    ).toBe("https://sentry.io/issues/abc/");
  });

  it("prefers a nested link-like URL over a top-level gravatar url", () => {
    expect(
      getNotificationOpenUrl(
        makeItem({
          source: "plugin",
          metadata: {
            url: "https://secure.gravatar.com/avatar/abc",
            entity: { issueUrl: "https://app.example.com/tickets/5" },
          },
        })
      )
    ).toBe("https://app.example.com/tickets/5");
  });

  it("extracts URL from title when metadata has none", () => {
    expect(
      getNotificationOpenUrl(
        makeItem({
          source: "alerts",
          metadata: {},
          title: "Build failed — see https://ci.example.com/runs/12",
        })
      )
    ).toBe("https://ci.example.com/runs/12");
  });
});
