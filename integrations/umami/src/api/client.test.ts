import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveVisitors, getMetrics, getPageviews, getStats } from "./client";

describe("umami client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses the normalized base url and queries stats endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pageviews: { value: 100, prev: 80 },
          visitors: { value: 50, prev: 40 },
          visits: { value: 70, prev: 60 },
          bounces: { value: 10, prev: 8 },
          totaltime: { value: 2000, prev: 1800 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ visitors: 9 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pageviews: [], sessions: [{ x: "2026-03-20T00:00:00.000Z", y: 7 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ x: "/pricing", y: 42 }],
      });
    vi.stubGlobal("fetch", fetchMock);

    const config = {
      apiKey: "umami-key",
      baseUrl: "https://cloud.umami.is///",
      websiteId: "site-1",
    };

    await expect(getStats(config, 1, 2)).resolves.toMatchObject({
      pageviews: { value: 100, prev: 80 },
    });
    await expect(getActiveVisitors(config)).resolves.toEqual({ visitors: 9 });
    await expect(getPageviews(config, 1, 2, "week")).resolves.toEqual({
      pageviews: [],
      sessions: [{ x: "2026-03-20T00:00:00.000Z", y: 7 }],
    });
    await expect(getMetrics(config, "url", 1, 2)).resolves.toEqual([{ x: "/pricing", y: 42 }]);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://cloud.umami.is/api/websites/site-1/stats?startAt=1&endAt=2"
    );
  });

  it("marks 429s as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "slow down",
      })
    );

    await expect(
      getMetrics(
        { apiKey: "umami-key", baseUrl: "https://cloud.umami.is", websiteId: "site-1" },
        "browser"
      )
    ).rejects.toMatchObject({
      status: 429,
      retryable: true,
    });
  });

  it("uses default ranges until cache expiry and treats 400s as non-retryable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pageviews: { value: 10, prev: 8 },
          visitors: { value: 5, prev: 4 },
          visits: { value: 7, prev: 6 },
          bounces: { value: 2, prev: 1 },
          totaltime: { value: 300, prev: 200 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pageviews: { value: 12, prev: 10 },
          visitors: { value: 6, prev: 5 },
          visits: { value: 9, prev: 8 },
          bounces: { value: 1, prev: 2 },
          totaltime: { value: 360, prev: 300 },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "bad request",
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getStats({ apiKey: "umami-key", baseUrl: "https://cloud.umami.is", websiteId: "site-2" })
    ).resolves.toMatchObject({
      visits: { value: 7, prev: 6 },
    });
    await expect(
      getStats({ apiKey: "umami-key", baseUrl: "https://cloud.umami.is", websiteId: "site-2" })
    ).resolves.toMatchObject({
      visits: { value: 7, prev: 6 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60 * 1000 + 1);

    await expect(
      getStats({ apiKey: "umami-key", baseUrl: "https://cloud.umami.is", websiteId: "site-2" })
    ).resolves.toMatchObject({
      visits: { value: 9, prev: 8 },
    });
    await expect(
      getPageviews(
        { apiKey: "umami-key", baseUrl: "https://cloud.umami.is", websiteId: "site-2" },
        undefined,
        undefined,
        "hour"
      )
    ).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
  });
});
