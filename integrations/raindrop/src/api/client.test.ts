import { afterEach, describe, expect, it, vi } from "vitest";
import { evictCacheByPrefix, getCollections, getRecentRaindrops } from "./client";

describe("raindrop client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    evictCacheByPrefix("raindrop:");
  });

  it("requests recent raindrops with the expected auth header and query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: true, items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getRecentRaindrops(
      {
        accessToken: "rd_test",
      },
      { perpage: 25 }
    );

    expect(fetchMock).toHaveBeenCalledOnce();

    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toBe("/rest/v1/raindrops/0");
    expect(url.searchParams.get("sort")).toBe("-created");
    expect(url.searchParams.get("perpage")).toBe("25");
    expect(url.searchParams.get("page")).toBe("0");
    expect(url.searchParams.get("nested")).toBe("true");
    expect((init as RequestInit | undefined)?.headers).toEqual({
      Authorization: "Bearer rd_test",
    });
  });

  it("uses the in-memory cache until evicted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: true, items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getCollections({ accessToken: "rd_test" });
    await getCollections({ accessToken: "rd_test" });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    evictCacheByPrefix("raindrop:collections");

    await getCollections({ accessToken: "rd_test" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
