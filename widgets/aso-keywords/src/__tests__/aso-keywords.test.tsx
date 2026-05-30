// @vitest-environment jsdom
import type { AsoKeywordsData } from "@radarboard/types/aso-keywords";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { asoKeywordsDescriptor } from "..";

const mockUseAsoKeywords = vi.fn();

vi.mock("../hooks/use-aso-keywords", () => ({
  useAsoKeywords: (...args: unknown[]) => mockUseAsoKeywords(...args),
}));

const FIXTURE: AsoKeywordsData = {
  appId: "app",
  availableStores: ["us"],
  configured: true,
  summary: {
    total: 1,
    top1: 0,
    top2: 0,
    top3: 0,
    top10: 1,
    top50: 1,
    improving: 1,
    declining: 0,
    avgRanking: 8,
  },
  keywords: [
    {
      keyword: "souls directory",
      currentRanking: 8,
      previousRanking: 12,
      rankingChange: 4,
      difficulty: 42,
      popularity: 61,
      appsCount: 240,
      lastUpdate: new Date(Date.now() - 3_600_000).toISOString(),
      store: "us",
    },
    {
      keyword: "temple map",
      currentRanking: 22,
      previousRanking: 22,
      rankingChange: 0,
      difficulty: 18,
      popularity: 30,
      appsCount: 80,
      lastUpdate: new Date(Date.now() - 3_600_000).toISOString(),
      store: "us",
    },
  ],
  lastAstroUpdate: new Date(Date.now() - 3_600_000).toISOString(),
  _fetchedAt: 1_700_000_000,
};

describe("ASO Keywords template-backed detail flow", () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    mockUseAsoKeywords.mockReset();
    mockUseAsoKeywords.mockReturnValue({
      data: FIXTURE,
      loading: false,
      configured: true,
      isStale: false,
      fetchedAt: FIXTURE._fetchedAt,
      refetch: vi.fn(async () => {}),
    });
  });

  it("opens the compact detail modal from the dense ranked row", async () => {
    const onSelectedDetailIdChange = vi.fn();

    render(
      createElement(asoKeywordsDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: asoKeywordsDescriptor.defaultConfig,
        onSelectedDetailIdChange,
      })
    );

    const row = await screen.findByRole("button", { name: /souls directory/i });
    row.click();

    expect(onSelectedDetailIdChange).toHaveBeenCalledWith("aso.keyword:souls directory::us");
  });

  it("applies persisted expanded filters to the compact widget", async () => {
    localStorage.setItem(
      "radarboard:widget:aso-keywords:expanded",
      JSON.stringify({
        onlyChanged: true,
        store: "",
        popularity: { min: 0, max: 100, enabled: false },
        difficulty: { min: 0, max: 100, enabled: false },
        rank: { min: 1, max: 1000, enabled: false },
      })
    );

    render(
      createElement(asoKeywordsDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: asoKeywordsDescriptor.defaultConfig,
      })
    );

    expect((await screen.findAllByText("souls directory")).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByText("temple map")).toBeNull();
    });
  });

  it("uses the same selection flow in the expanded ranked table", async () => {
    const ExpandedComponent = asoKeywordsDescriptor.expandedComponent;
    if (!ExpandedComponent) {
      throw new Error("ASO Keywords widget must provide an expanded component");
    }

    const onSelectedDetailIdChange = vi.fn();

    render(
      createElement(ExpandedComponent, {
        projectSlug: "goshuin-atlas",
        config: asoKeywordsDescriptor.defaultConfig,
        onSelectedDetailIdChange,
      })
    );

    const rowCell = (await screen.findAllByText("souls directory")).at(-1);
    if (!rowCell) {
      throw new Error("Expected an expanded ASO keyword row");
    }
    rowCell.click();

    expect(onSelectedDetailIdChange).toHaveBeenCalledWith("aso.keyword:souls directory::us");
  });
});
