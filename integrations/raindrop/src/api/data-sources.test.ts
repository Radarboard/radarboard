import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import type { RaindropResponse } from "@radarboard/types/raindrop";
import { afterEach, describe, expect, it, vi } from "vitest";

const getRecentRaindrops = vi.fn();
const getCollections = vi.fn();
const getTags = vi.fn();

vi.mock("./client", () => ({
  getRecentRaindrops: (...args: unknown[]) => getRecentRaindrops(...args),
  getCollections: (...args: unknown[]) => getCollections(...args),
  getTags: (...args: unknown[]) => getTags(...args),
  RaindropAPIError: class RaindropAPIError extends Error {
    constructor(
      public readonly status: number,
      message: string
    ) {
      super(message);
    }
  },
}));

import { raindropDataSource } from "./data-sources";

function makeContext(overrides: Partial<DataSourceContext> = {}): DataSourceContext {
  return {
    resolveCredential: vi.fn().mockResolvedValue(null),
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
    getAllProjects: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("raindropDataSource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    getRecentRaindrops.mockReset();
    getCollections.mockReset();
    getTags.mockReset();
  });

  it("uses a stable cache key", () => {
    expect(
      raindropDataSource.buildCacheKey?.({
        projectSlug: null,
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
      })
    ).toBe("raindrop:all:30d:UTC");
  });

  it("returns configured false when neither credentials nor MCP are available", async () => {
    const data = (await raindropDataSource.fetch(
      {
        projectSlug: null,
        range: "all",
        timeZone: "UTC",
        forceRefresh: false,
      },
      makeContext()
    )) as RaindropResponse;

    expect(data).toMatchObject({
      configured: false,
      recent: [],
      collections: [],
      topTags: [],
    });
  });

  it("shapes REST responses into widget-friendly data", async () => {
    getRecentRaindrops.mockResolvedValue({
      result: true,
      items: [
        {
          _id: 11,
          title: "Raindrop Docs",
          excerpt: "Official docs",
          link: "https://developer.raindrop.io",
          domain: "developer.raindrop.io",
          created: "2026-03-19T12:00:00.000Z",
          lastUpdate: "2026-03-19T12:00:00.000Z",
          tags: ["docs", "api"],
          important: true,
          collection: { $id: 101 },
        },
      ],
    });
    getCollections.mockResolvedValue({
      result: true,
      items: [
        {
          _id: 101,
          title: "Reference",
          count: 18,
          color: "#5b8af5",
          lastUpdate: "2026-03-19T12:00:00.000Z",
        },
      ],
    });
    getTags.mockResolvedValue({
      result: true,
      items: [
        { _id: "docs", count: 8 },
        { _id: "api", count: 5 },
      ],
    });

    const data = (await raindropDataSource.fetch(
      {
        projectSlug: null,
        range: "all",
        timeZone: "UTC",
        forceRefresh: false,
      },
      makeContext({
        resolveCredential: vi.fn().mockResolvedValue({ accessToken: "rd_test" }),
      })
    )) as RaindropResponse;

    expect(data.configured).toBe(true);
    expect(data.source).toBe("api");
    expect(data.summary).toEqual({
      savedCount: 18,
      totalCollections: 1,
      totalTags: 2,
      recentCount: 1,
    });
    expect(data.recent[0]).toMatchObject({
      title: "Raindrop Docs",
      collectionTitle: "Reference",
      raindropUrl: "https://app.raindrop.io/my/0/item/11",
    });
  });

  it("scopes Raindrop metrics, collections, and recent items to the requested range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));

    getCollections.mockResolvedValue({
      result: true,
      items: [
        {
          _id: 101,
          title: "Reference",
          count: 18,
          color: "#5b8af5",
          lastUpdate: "2026-03-19T12:00:00.000Z",
        },
        {
          _id: 102,
          title: "Protocols",
          count: 7,
          color: "#34d399",
          lastUpdate: "2026-03-18T12:00:00.000Z",
        },
      ],
    });
    getRecentRaindrops
      .mockResolvedValueOnce({
        result: true,
        items: [
          {
            _id: 11,
            title: "Fresh docs",
            excerpt: "Recent reference",
            link: "https://developer.raindrop.io",
            domain: "developer.raindrop.io",
            created: "2026-03-19T12:00:00.000Z",
            lastUpdate: "2026-03-19T12:00:00.000Z",
            tags: ["docs", "api"],
            important: true,
            collection: { $id: 101 },
          },
          {
            _id: 12,
            title: "Fresh protocol",
            excerpt: "Recent protocol",
            link: "https://modelcontextprotocol.io",
            domain: "modelcontextprotocol.io",
            created: "2026-03-18T12:00:00.000Z",
            lastUpdate: "2026-03-18T12:00:00.000Z",
            tags: ["mcp"],
            important: false,
            collection: { $id: 102 },
          },
          {
            _id: 13,
            title: "Outside the selected window",
            excerpt: "Too old",
            link: "https://example.com/old",
            domain: "example.com",
            created: "2026-03-01T12:00:00.000Z",
            lastUpdate: "2026-03-01T12:00:00.000Z",
            tags: ["archive"],
            important: false,
            collection: { $id: 101 },
          },
        ],
      })
      .mockResolvedValueOnce({
        result: true,
        items: [],
      });

    const data = (await raindropDataSource.fetch(
      {
        projectSlug: null,
        range: "7d",
        timeZone: "UTC",
        forceRefresh: false,
      },
      makeContext({
        resolveCredential: vi.fn().mockResolvedValue({ accessToken: "rd_test" }),
      })
    )) as RaindropResponse;

    expect(getTags).not.toHaveBeenCalled();
    expect(data.summary).toEqual({
      savedCount: 2,
      totalCollections: 2,
      totalTags: 3,
      recentCount: 2,
    });
    expect(data.recent.map((item) => item.title)).toEqual(["Fresh docs", "Fresh protocol"]);
    expect(data.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 101, count: 1 }),
        expect.objectContaining({ id: 102, count: 1 }),
      ])
    );
    expect(data.topTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "api", count: 1 }),
        expect.objectContaining({ name: "docs", count: 1 }),
        expect.objectContaining({ name: "mcp", count: 1 }),
      ])
    );
  });

  it("returns a soft configuration error when REST credentials are missing", async () => {
    const data = (await raindropDataSource.fetch(
      {
        projectSlug: null,
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
      },
      makeContext({
        resolveCredential: vi.fn().mockResolvedValue(null),
      })
    )) as RaindropResponse;

    expect(data.configured).toBe(false);
    expect(data.source).toBe("api");
    expect(data.error).toContain("API credentials are required");
  });
});
