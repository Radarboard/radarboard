// @vitest-environment jsdom

import { MOCK_ANALYTICS } from "@radarboard/widget-engine/mock-data";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAnalytics } from "./use-analytics";

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

describe("useAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectiveTimeZoneMock.mockReturnValue("America/Toronto");
    usePollingIntervalMock.mockReturnValue(60_000);
    buildUrlMock.mockReturnValue(
      "/api/analytics/data?range=7d&project=radarboard&timezone=America/Toronto"
    );
    swrMock.mockReturnValue({
      data: {
        configured: true,
        analytics: { ...MOCK_ANALYTICS, liveVisitors: 12 },
        _fetchedAt: 123,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("always uses the real SWR key", () => {
    const { result } = renderHook(() => useAnalytics("7d", "radarboard"));

    expect(swrMock).toHaveBeenCalledWith(
      "/api/analytics/data?range=7d&project=radarboard&timezone=America/Toronto",
      expect.any(Function),
      {
        refreshInterval: 60_000,
        shouldRetryOnError: false,
      }
    );
    expect(result.current.data).toMatchObject({ liveVisitors: 12 });
    expect(result.current.configured).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("returns fetched analytics and can refetch with the refresh flag", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: true,
        analytics: { ...MOCK_ANALYTICS, liveVisitors: 12 },
        _fetchedAt: 123,
      },
      error: null,
      isLoading: false,
      mutate: mutateMock,
    });
    apiFetcherMock.mockResolvedValue({
      configured: true,
      analytics: { ...MOCK_ANALYTICS, liveVisitors: 21 },
      _fetchedAt: 456,
    });

    const { result } = renderHook(() => useAnalytics("7d", "radarboard"));

    expect(buildUrlMock).toHaveBeenCalledWith("/api/analytics/data", {
      range: "7d",
      project: "radarboard",
      timezone: "America/Toronto",
    });
    expect(result.current.data).toMatchObject({ liveVisitors: 12 });

    await result.current.refetch();

    expect(buildUrlMock).toHaveBeenLastCalledWith("/api/analytics/data", {
      range: "7d",
      project: "radarboard",
      timezone: "America/Toronto",
      refresh: "1",
    });
    expect(apiFetcherMock).toHaveBeenCalledWith(
      "/api/analytics/data?range=7d&project=radarboard&timezone=America/Toronto"
    );
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        analytics: { ...MOCK_ANALYTICS, liveVisitors: 21 },
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });
});
