// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KPIStrip } from "../index";

const useDashboardMock = vi.fn();
const useHealthMock = vi.fn();
const useSentryMock = vi.fn();
const useAppStoreMock = vi.fn();
const useShippingMock = vi.fn();
const useAnalyticsMock = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => useDashboardMock(),
  };
});

vi.mock("@/lib/extensions/runtime/ui/widget-chrome", () => ({
  useWidgetChromeHealth: () => useHealthMock(),
  useWidgetChromeSentry: (...args: unknown[]) => useSentryMock(...args),
  useWidgetChromeAppStore: (...args: unknown[]) => useAppStoreMock(...args),
  useWidgetChromeShipping: (...args: unknown[]) => useShippingMock(...args),
  useWidgetChromeAnalytics: (...args: unknown[]) => useAnalyticsMock(...args),
}));

describe("KPIStrip", () => {
  beforeEach(() => {
    useDashboardMock.mockReturnValue({ timeRange: "30d" });
    useHealthMock.mockReturnValue({ checks: [], configured: false });
    useSentryMock.mockReturnValue({ data: null, configured: false });
    useAppStoreMock.mockReturnValue({ data: null });
    useAnalyticsMock.mockReturnValue({ data: null });
    useShippingMock.mockReturnValue({
      items: [
        {
          id: "ship-1",
          title: "Deploy",
          source: "vercel",
          projectName: "Pixel Studio",
          projectColor: "#E63946",
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
      configured: true,
    });
  });

  it("renders compact project labels for deploy KPI entries", async () => {
    render(createElement(KPIStrip, { projectSlug: null }));

    expect(await screen.findByText("pixel-studio")).toBeTruthy();
    expect(screen.queryByText("Pixel Studio")).toBeNull();
  });
});
