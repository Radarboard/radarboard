// @vitest-environment jsdom

import { DATA_SOURCE_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";

const useRaindropMock = vi.fn();

vi.mock("../hooks/use-raindrop", () => ({
  useRaindrop: (...args: unknown[]) => useRaindropMock(...args),
}));

vi.mock("@radarboard/utils/format-time-ago", () => ({
  formatTimeAgo: vi.fn(() => "2h ago"),
}));

describe("raindrop data resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRaindropMock.mockReturnValue({
      data: {
        configured: false,
        source: "api",
        summary: { savedCount: 1, totalCollections: 1, totalTags: 1, recentCount: 1 },
        recent: [
          {
            id: 10,
            title: "Docs",
            domain: "www.example.com",
            created: "2026-03-20T00:00:00.000Z",
          },
        ],
        collections: [{ id: 20, title: "Reading" }],
        topTags: [],
        error: "token missing",
      },
      fetchedAt: 99,
      loading: true,
      error: "network failed",
      refetch: vi.fn(async () => {}),
    });
  });

  it("adds display helpers and setup messaging", async () => {
    const Resolver = DATA_SOURCE_REGISTRY.get("raindrop");
    const onState = vi.fn();

    if (!Resolver) throw new Error("raindrop resolver not registered");

    render(createElement(Resolver, { projectSlug: null, timeRange: "7d", onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchedAt: 99,
          loading: true,
          error: "network failed",
          data: expect.objectContaining({
            errorMessage: "network failed",
            errorPresent: true,
            setupMessage:
              "Raindrop is not configured. Add an access token or connect mcp::raindrop.",
            recent: [
              expect.objectContaining({
                key: "10",
                domainLabel: "example.com",
                savedAgo: "2h ago",
              }),
            ],
            collections: [expect.objectContaining({ key: "20" })],
          }),
        })
      );
    });
    expect(useRaindropMock).toHaveBeenCalledWith("7d");
  });
});
