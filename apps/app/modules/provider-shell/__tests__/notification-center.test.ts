import { describe, expect, it } from "vitest";
import { toDemoNotificationFeedItem } from "@/modules/provider-shell/notification-center";

describe("toDemoNotificationFeedItem", () => {
  it("converts mock demo notifications to feed items", () => {
    const items = toDemoNotificationFeedItem({}, 1_800_000_000);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toEqual(
      expect.objectContaining({
        deliveryId: "demo-notif-1",
        recordType: "event",
        source: "github",
        status: "delivered",
        channel: "in_app",
      })
    );
    expect(items.filter((item) => item.status === "delivered").length).toBeGreaterThan(0);
  });

  it("applies local read and dismissed status overrides", () => {
    const items = toDemoNotificationFeedItem(
      {
        "demo-notif-1": "read",
        "demo-notif-2": "dismissed",
      },
      1_800_000_000
    );

    expect(items.find((item) => item.deliveryId === "demo-notif-1")?.status).toBe("read");
    expect(items.some((item) => item.deliveryId === "demo-notif-2")).toBe(false);
  });
});
