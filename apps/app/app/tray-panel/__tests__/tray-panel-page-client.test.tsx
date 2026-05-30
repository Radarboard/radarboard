// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock the notifications hook
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock("@radarboard/hooks/use-notifications", () => ({
  useNotifications: vi.fn(() => ({
    notifications: [],
    unreadCount: 0,
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
    dismiss: vi.fn(),
    connected: true,
    isLoading: false,
    error: undefined,
  })),
}));

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
}));

// Mock the notification item component to simplify testing
vi.mock("@radarboard/feature-notifications", () => ({
  NotificationItem: ({ item }: { item: { title: string } }) =>
    createElement("div", { "data-testid": "notification-item" }, item.title),
}));

import { useNotifications } from "@radarboard/hooks/use-notifications";

// Import the page component directly using a relative path
// (vitest's @/ alias maps to the app root)
import TrayPanelPage from "../../../app/tray-panel/page";

describe("TrayPanelPage", () => {
  it("renders empty state when no notifications", () => {
    render(createElement(TrayPanelPage));
    expect(screen.getByText("No notifications")).toBeTruthy();
  });

  it("renders the header with title", () => {
    render(createElement(TrayPanelPage));
    expect(screen.getByText("Notifications")).toBeTruthy();
  });

  it("renders View All footer link", () => {
    render(createElement(TrayPanelPage));
    expect(screen.getByText(/View All in App/)).toBeTruthy();
  });

  it("does not show Mark All button when unreadCount is 0", () => {
    render(createElement(TrayPanelPage));
    expect(screen.queryByText("Mark All")).toBeNull();
  });

  it("shows Mark All button and badge when there are unread notifications", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [
        {
          deliveryId: "d-1",
          recordType: "event",
          notificationId: "n-1",
          source: "github",
          type: "pr.opened",
          severity: "info",
          projectSlug: "radarboard",
          title: "New PR opened",
          body: null,
          metadata: {},
          occurredAt: Math.floor(Date.now() / 1000),
          createdAt: Math.floor(Date.now() / 1000),
          eventCount: null,
          status: "delivered",
          channel: "in_app",
          deliveredAt: Math.floor(Date.now() / 1000),
          readAt: null,
        },
      ],
      unreadCount: 3,
      markRead: mockMarkRead,
      markAllRead: mockMarkAllRead,
      dismiss: vi.fn(),
      connected: true,
      isLoading: false,
      error: undefined,
    } as any);

    render(createElement(TrayPanelPage));

    expect(screen.getByText("Mark All")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("New PR opened")).toBeTruthy();
  });

  it("renders notification items", () => {
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [
        {
          deliveryId: "d-1",
          recordType: "event",
          notificationId: "n-1",
          source: "github",
          type: "pr.opened",
          severity: "info",
          projectSlug: null,
          title: "First notification",
          body: null,
          metadata: {},
          occurredAt: Math.floor(Date.now() / 1000),
          createdAt: Math.floor(Date.now() / 1000),
          eventCount: null,
          status: "delivered",
          channel: "in_app",
          deliveredAt: Math.floor(Date.now() / 1000),
          readAt: null,
        },
        {
          deliveryId: "d-2",
          recordType: "event",
          notificationId: "n-2",
          source: "vercel",
          type: "deploy.succeeded",
          severity: "success",
          projectSlug: null,
          title: "Second notification",
          body: null,
          metadata: {},
          occurredAt: Math.floor(Date.now() / 1000),
          createdAt: Math.floor(Date.now() / 1000),
          eventCount: null,
          status: "delivered",
          channel: "in_app",
          deliveredAt: Math.floor(Date.now() / 1000),
          readAt: null,
        },
      ],
      unreadCount: 2,
      markRead: mockMarkRead,
      markAllRead: mockMarkAllRead,
      dismiss: vi.fn(),
      connected: true,
      isLoading: false,
      error: undefined,
    } as any);

    render(createElement(TrayPanelPage));

    const items = screen.getAllByTestId("notification-item");
    expect(items).toHaveLength(2);
    expect(screen.getByText("First notification")).toBeTruthy();
    expect(screen.getByText("Second notification")).toBeTruthy();
  });
});
