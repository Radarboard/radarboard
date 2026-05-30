// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRaindrop } from "./use-raindrop";

const apiFetcherMock = vi.fn();
const buildUrlMock = vi.fn();
const useEffectiveTimeZoneMock = vi.fn();
const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/fetcher", () => ({
  apiFetcher: (...args: unknown[]) => apiFetcherMock(...args),
  buildUrl: (...args: unknown[]) => buildUrlMock(...args),
}));

vi.mock("@radarboard/hooks/use-effective-timezone", () => ({
  useEffectiveTimeZone: (...args: unknown[]) => useEffectiveTimeZoneMock(...args),
}));

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: (...args: unknown[]) => usePollingIntervalMock(...args),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

describe("useRaindrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectiveTimeZoneMock.mockReturnValue("America/Toronto");
    usePollingIntervalMock.mockReturnValue(45_000);
    buildUrlMock.mockReturnValue(
      "/api/integrations/raindrop/data?range=7d&timezone=America%2FToronto"
    );
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("builds the swr key with timezone-aware params", () => {
    const { result } = renderHook(() => useRaindrop("7d"));

    expect(buildUrlMock).toHaveBeenCalledWith("/api/integrations/raindrop/data", {
      range: "7d",
      timezone: "America/Toronto",
    });
    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/raindrop/data?range=7d&timezone=America%2FToronto",
      expect.any(Function),
      {
        refreshInterval: 45_000,
        shouldRetryOnError: false,
        dedupingInterval: 45_000,
        revalidateOnReconnect: false,
      }
    );
    expect(result.current.data).toBeNull();
    expect(result.current.configured).toBe(false);
  });

  it("returns fetched data and refetches with the refresh flag", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: false,
        recent: [{ id: 1 }],
        _fetchedAt: 123,
      },
      error: { message: "upstream failed" },
      isLoading: true,
      mutate: mutateMock,
    });
    apiFetcherMock.mockResolvedValue({
      configured: true,
      recent: [{ id: 2 }],
      _fetchedAt: 456,
    });

    const { result } = renderHook(() => useRaindrop("7d"));

    expect(result.current.configured).toBe(false);
    expect(result.current.fetchedAt).toBe(123);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("upstream failed");

    await result.current.refetch();

    expect(buildUrlMock).toHaveBeenLastCalledWith("/api/integrations/raindrop/data", {
      range: "7d",
      timezone: "America/Toronto",
      refresh: "1",
    });
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        recent: [{ id: 2 }],
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });
});
