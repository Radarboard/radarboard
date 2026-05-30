// @vitest-environment jsdom

import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTauriTraySync } from "../use-tauri-tray-sync";

// ── Mocks ──

const mockInvoke = vi.fn();
const mockListen = vi.fn(() => vi.fn()); // returns unlisten function

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

// ── Helpers ──

function makeNotification(overrides: Partial<NotificationFeedItem> = {}): NotificationFeedItem {
  return {
    deliveryId: `delivery-${Math.random().toString(36).slice(2, 8)}`,
    recordType: "event",
    notificationId: `notif-${Math.random().toString(36).slice(2, 8)}`,
    source: "github",
    type: "pr.opened",
    severity: "info",
    projectSlug: "radarboard",
    title: "New PR opened",
    body: "PR #42 by @alice",
    metadata: {},
    occurredAt: Math.floor(Date.now() / 1000),
    createdAt: Math.floor(Date.now() / 1000),
    eventCount: null,
    status: "delivered",
    channel: "in_app",
    deliveredAt: Math.floor(Date.now() / 1000),
    readAt: null,
    ...overrides,
  };
}

function enableTauri() {
  (window as any).__TAURI_INTERNALS__ = {};
}

function disableTauri() {
  delete (window as any).__TAURI_INTERNALS__;
}

// ── Tests ──

describe("useTauriTraySync", () => {
  beforeEach(() => {
    enableTauri();
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(undefined);
    mockListen.mockClear();
    mockListen.mockResolvedValue(vi.fn());
  });

  afterEach(() => {
    disableTauri();
  });

  it("does nothing when not in Tauri", async () => {
    disableTauri();

    renderHook(() =>
      useTauriTraySync({
        notifications: [makeNotification()],
        unreadCount: 1,
        markAllRead: vi.fn(),
      })
    );

    // Give the async effect time to run
    await vi.waitFor(() => {
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  it("sets tray state to 'normal' when no unread notifications", async () => {
    renderHook(() =>
      useTauriTraySync({
        notifications: [],
        unreadCount: 0,
        markAllRead: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_tray_state", {
        state: "normal",
        unreadCount: 0,
        statusText: "No unread notifications",
      });
    });
  });

  it("sets tray state to 'badge' when there are unread notifications", async () => {
    const notifications = [makeNotification({ severity: "info", status: "delivered" })];

    renderHook(() =>
      useTauriTraySync({
        notifications,
        unreadCount: 3,
        markAllRead: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_tray_state", {
        state: "badge",
        unreadCount: 3,
        statusText: "3 unread notifications",
      });
    });
  });

  it("sets tray state to 'critical' when a critical unread notification exists", async () => {
    const notifications = [
      makeNotification({ severity: "critical", status: "delivered" }),
      makeNotification({ severity: "info", status: "delivered" }),
    ];

    renderHook(() =>
      useTauriTraySync({
        notifications,
        unreadCount: 2,
        markAllRead: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_tray_state", {
        state: "critical",
        unreadCount: 2,
        statusText: "2 unread notifications",
      });
    });
  });

  it("does not treat read critical notifications as critical state", async () => {
    const notifications = [makeNotification({ severity: "critical", status: "read" })];

    renderHook(() =>
      useTauriTraySync({
        notifications,
        unreadCount: 0,
        markAllRead: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_tray_state", {
        state: "normal",
        unreadCount: 0,
        statusText: "No unread notifications",
      });
    });
  });

  it("sends recent events with max 5 items", async () => {
    const notifications = Array.from({ length: 8 }, (_, i) =>
      makeNotification({
        deliveryId: `d-${i}`,
        title: `Event ${i}`,
        severity: "info",
        source: "github",
      })
    );

    renderHook(() =>
      useTauriTraySync({
        notifications,
        unreadCount: 8,
        markAllRead: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "update_tray_recent_events",
        expect.objectContaining({
          events: expect.any(Array),
        })
      );
    });

    // Find the call and verify only 5 events sent
    const call = mockInvoke.mock.calls.find((c: unknown[]) => c[0] === "update_tray_recent_events");
    expect(call).toBeDefined();
    expect(call?.[1].events).toHaveLength(5);
    expect(call?.[1].events[0].deliveryId).toBe("d-0");
    expect(call?.[1].events[4].deliveryId).toBe("d-4");
  });

  it("uses singular 'notification' for count of 1", async () => {
    renderHook(() =>
      useTauriTraySync({
        notifications: [makeNotification()],
        unreadCount: 1,
        markAllRead: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_tray_state", {
        state: "badge",
        unreadCount: 1,
        statusText: "1 unread notification",
      });
    });
  });

  it("registers event listeners for tray menu actions", async () => {
    renderHook(() =>
      useTauriTraySync({
        notifications: [],
        unreadCount: 0,
        markAllRead: vi.fn(),
      })
    );

    await vi.waitFor(() => {
      const listenedEvents = mockListen.mock.calls.map((c: unknown[]) => c[0]);
      expect(listenedEvents).toContain("mark-all-read");
      expect(listenedEvents).toContain("pause-notifications");
      expect(listenedEvents).toContain("resume-notifications");
      expect(listenedEvents).toContain("navigate");
    });
  });

  it("calls markAllRead when mark-all-read event fires", async () => {
    const markAllRead = vi.fn();
    let markAllReadCallback: (() => void) | undefined;

    mockListen.mockImplementation(async (event: string, callback: (...args: unknown[]) => void) => {
      if (event === "mark-all-read") {
        markAllReadCallback = callback;
      }
      return vi.fn(); // unlisten
    });

    renderHook(() =>
      useTauriTraySync({
        notifications: [],
        unreadCount: 0,
        markAllRead,
      })
    );

    await vi.waitFor(() => {
      expect(markAllReadCallback).toBeDefined();
    });

    markAllReadCallback?.();
    expect(markAllRead).toHaveBeenCalledOnce();
  });

  it("skips set_tray_state invoke when state has not changed", async () => {
    const notifications = [makeNotification()];
    const props = { notifications, unreadCount: 1, markAllRead: vi.fn() };

    renderHook(() => useTauriTraySync(props));

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_tray_state", expect.any(Object));
    });

    const setTrayStateCalls = () =>
      mockInvoke.mock.calls.filter((c: unknown[]) => c[0] === "set_tray_state").length;

    // set_tray_state should have been called exactly once
    expect(setTrayStateCalls()).toBe(1);
  });
});
