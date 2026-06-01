// @vitest-environment jsdom

import { DATA_SOURCE_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";

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

describe("shipping data resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardMock.mockReturnValue({ timeRange: "7d" });
    useShippingMock.mockReturnValue({
      items: [
        { id: "ship-1", title: "Fix bug", source: "bug", projectName: "Goshuin Atlas" },
        { id: "ship-2", title: "Ship feature", source: "done", projectName: "Radarboard" },
      ],
      configured: true,
      fetchedAt: 55,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("maps semantic project data and source colors without pre-normalizing badge labels", async () => {
    const Resolver = DATA_SOURCE_REGISTRY.get("shipping");
    const onState = vi.fn();

    if (!Resolver) throw new Error("shipping resolver not registered");

    render(createElement(Resolver, { projectSlug: "atlas", onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            configured: true,
            items: [
              expect.objectContaining({
                projectName: "Goshuin Atlas",
                sourceColor: "#e05555",
              }),
              expect.objectContaining({ projectName: "Radarboard", sourceColor: "#4ade80" }),
            ],
          }),
        })
      );
    });
    expect(useShippingMock).toHaveBeenCalledWith("atlas", "7d");
  });

  it("covers the remaining source color variants", async () => {
    useShippingMock.mockReturnValue({
      items: [
        { id: "1", source: "idea", projectName: "Atlas" },
        { id: "2", source: "open", projectName: "Atlas" },
        { id: "3", source: "github", projectName: "Atlas" },
        { id: "4", source: "in_progress", projectName: "Atlas" },
        { id: "5", source: "vercel", projectName: "Atlas" },
        { id: "6", source: "linear", projectName: "Atlas" },
        { id: "7", source: "mystery", projectName: "Atlas" },
      ],
      configured: false,
      fetchedAt: null,
      loading: true,
      error: "upstream",
      refetch: null,
    });
    const Resolver = DATA_SOURCE_REGISTRY.get("shipping");
    const onState = vi.fn();

    if (!Resolver) throw new Error("shipping resolver not registered");

    render(createElement(Resolver, { projectSlug: null, onState }));

    await waitFor(() => {
      const call = onState.mock.calls.at(-1)?.[0];
      expect(call).toMatchObject({
        loading: true,
        error: "upstream",
        data: {
          configured: false,
          ctaLabel: "Choose integration",
          ctaTarget: "intent:release-activity",
          setupMessage: "Connect GitHub, Linear, or Vercel to show release activity.",
        },
      });
      expect(call.data.items.map((item: { sourceColor: string }) => item.sourceColor)).toEqual([
        "#5b8af5",
        "#5b8af5",
        "#5b8af5",
        "#f5c542",
        "#f5c542",
        "#4ade80",
        "#777",
      ]);
    });
  });
});
