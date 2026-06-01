import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  googleSearchConsoleDataSource,
  googleSearchConsoleQueryDataSource,
  googleSearchConsoleSitesDataSource,
} from "../google-search-console-data-sources";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function makeContext(overrides: Partial<DataSourceContext> = {}): DataSourceContext {
  return {
    resolveCredential: async () => ({ accessToken: "access-token" }),
    getProjectIntegrations: async () => ({}),
    getAllProjects: async () => [],
    ...overrides,
  };
}

describe("googleSearchConsoleDataSources", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns an unconfigured state when no credentials are available", async () => {
    const result = await googleSearchConsoleDataSource.fetch(
      {
        projectSlug: null,
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
        siteUrl: null,
      },
      makeContext({ resolveCredential: async () => null })
    );

    expect(result).toEqual({ configured: false });
  });

  it("lists Search Console sites for the connected account", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        siteEntry: [
          { siteUrl: "https://radarboard.app/", permissionLevel: "siteOwner" },
          { siteUrl: "sc-domain:radarboard.app", permissionLevel: "siteFullUser" },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await googleSearchConsoleSitesDataSource.fetch(
      {
        projectSlug: null,
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
      },
      makeContext()
    );

    expect(result).toEqual({
      configured: true,
      sites: [
        { siteUrl: "https://radarboard.app/", permissionLevel: "siteOwner" },
        { siteUrl: "sc-domain:radarboard.app", permissionLevel: "siteFullUser" },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://searchconsole.googleapis.com/webmasters/v3/sites",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toBeInstanceOf(Headers);
    expect(
      ((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers).get("Authorization")
    ).toBe("Bearer access-token");
  });

  it("fetches SEO overview data for a mapped project site", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          rows: [
            {
              keys: ["radarboard"],
              clicks: 40,
              impressions: 1000,
              ctr: 0.04,
              position: 3.2,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          rows: [
            { keys: ["2026-05-30"], clicks: 10, impressions: 250, ctr: 0.04, position: 4 },
            { keys: ["2026-05-31"], clicks: 30, impressions: 750, ctr: 0.04, position: 3 },
          ],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await googleSearchConsoleDataSource.fetch(
      {
        projectSlug: "radarboard",
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
        siteUrl: null,
      },
      makeContext({
        getAllProjects: async () => [
          {
            slug: "radarboard",
            name: "Radarboard",
            color: "#666666",
            platforms: [
              {
                id: "website",
                name: "Website",
                integrations: {},
              },
            ],
          },
        ],
        getProjectIntegrations: async () => ({
          radarboard: {
            website: {
              "googleSearchConsole.siteUrl": "https://radarboard.app/",
            },
          },
        }),
      })
    );

    expect(result).toMatchObject({
      configured: true,
      seo: {
        totalClicks: 40,
        totalImpressions: 1000,
        avgCtr: 4,
        avgPosition: 3.25,
        latestAvailableDate: "2026-05-31",
        queries: [
          {
            query: "radarboard",
            clicks: 40,
            impressions: 1000,
            ctr: 4,
            position: 3.2,
            projectName: "Radarboard",
            projectColor: "#666666",
            siteUrl: "https://radarboard.app/",
          },
        ],
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://searchconsole.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fradarboard.app%2F/searchAnalytics/query",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"dimensions":["query"]'),
      })
    );
  });

  it("refreshes legacy gws CLI credentials before calling Search Console", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "fresh-access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          siteEntry: [{ siteUrl: "https://radarboard.app/", permissionLevel: "siteOwner" }],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ rows: [] }))
      .mockResolvedValueOnce(jsonResponse({ rows: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await googleSearchConsoleDataSource.fetch(
      {
        projectSlug: null,
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
        siteUrl: null,
      },
      makeContext({
        resolveCredential: async () => ({
          clientId: "client-id",
          clientSecret: "client-secret",
          refreshToken: "refresh-token",
        }),
      })
    );

    expect(result).toMatchObject({ configured: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://searchconsole.googleapis.com/webmasters/v3/sites",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    expect(
      ((fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers).get("Authorization")
    ).toBe("Bearer fresh-access-token");
  });

  it("fetches per-query detail with a Search Console query filter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          rows: [{ keys: ["2026-05-31"], clicks: 12, impressions: 100, ctr: 0.12, position: 2 }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          rows: [
            {
              keys: ["https://radarboard.app/"],
              clicks: 12,
              impressions: 100,
              ctr: 0.12,
              position: 2,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          rows: [{ keys: ["DESKTOP"], clicks: 8, impressions: 60, ctr: 0.1333, position: 1.8 }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          rows: [{ keys: ["usa"], clicks: 7, impressions: 55, ctr: 0.1272, position: 1.9 }],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await googleSearchConsoleQueryDataSource.fetch(
      {
        projectSlug: null,
        range: "30d",
        timeZone: "UTC",
        forceRefresh: false,
        query: "radarboard",
        siteUrl: "https://radarboard.app/",
      },
      makeContext()
    );

    expect(result).toMatchObject({
      configured: true,
      detail: {
        clicksTrend: [{ date: "2026-05-31", value: 12 }],
        impressionsTrend: [{ date: "2026-05-31", value: 100 }],
        positionTrend: [{ date: "2026-05-31", value: 2 }],
        pages: [{ page: "https://radarboard.app/", clicks: 12 }],
        devices: [{ device: "DESKTOP", clicks: 8 }],
        countries: [{ country: "usa", clicks: 7 }],
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://searchconsole.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fradarboard.app%2F/searchAnalytics/query",
      expect.objectContaining({
        body: expect.stringContaining('"expression":"radarboard"'),
      })
    );
  });
});
