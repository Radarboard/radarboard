// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { shippingDescriptor } from "..";

const useDashboardMock = vi.fn();
const useShippingMock = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => useDashboardMock(),
  };
});

vi.mock("../hooks/use-shipping", () => ({
  useShipping: (...args: unknown[]) => useShippingMock(...args),
}));

describe("shippingDescriptor compact", () => {
  beforeEach(() => {
    useDashboardMock.mockReturnValue({ timeRange: "7d" });
    useShippingMock.mockReturnValue({
      items: [],
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("reports disconnected chrome state when release activity is not configured", async () => {
    const onChromeStateChange = vi.fn();
    const onConnectService = vi.fn();

    render(
      createElement(shippingDescriptor.component, {
        widgetId: "shipping",
        projectSlug: null,
        config: shippingDescriptor.defaultConfig,
        onChromeStateChange,
        onConnectService,
      })
    );

    expect(
      await screen.findByText("Connect GitHub, Linear, or Vercel to show release activity.")
    ).toBeTruthy();
    await waitFor(() => {
      expect(onChromeStateChange).toHaveBeenCalledWith("disconnected");
    });
    await userEvent.click(screen.getByRole("button", { name: "Choose integration" }));
    expect(onConnectService).toHaveBeenCalledWith("intent:release-activity");
  });
});
