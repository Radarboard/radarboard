// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShipping } from "./use-shipping";

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

describe("useShipping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectiveTimeZoneMock.mockReturnValue("UTC");
    usePollingIntervalMock.mockReturnValue(60_000);
    buildUrlMock.mockReturnValue(
      "/api/integrations/shipping/data?project=atlas&range=7d&timezone=UTC"
    );
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("builds a project-aware shipping key", () => {
    const { result } = renderHook(() => useShipping("atlas", "7d"));

    expect(buildUrlMock).toHaveBeenCalledWith("/api/integrations/shipping/data", {
      project: "atlas",
      range: "7d",
      timezone: "UTC",
    });
    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/shipping/data?project=atlas&range=7d&timezone=UTC",
      expect.any(Function),
      { refreshInterval: 60_000, shouldRetryOnError: false }
    );
    expect(result.current.items).toEqual([]);
    expect(result.current.configured).toBe(false);
  });

  it("returns fetched items and can refetch", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: false,
        items: [{ id: "ship-1", title: "Ship it" }],
        _fetchedAt: 123,
        error: "payload error",
      },
      error: null,
      isLoading: true,
      mutate: mutateMock,
    });
    apiFetcherMock.mockResolvedValue({
      configured: true,
      items: [{ id: "ship-2", title: "Done" }],
      _fetchedAt: 456,
    });

    const { result } = renderHook(() => useShipping("atlas", "7d"));

    expect(result.current.items).toEqual([{ id: "ship-1", title: "Ship it" }]);
    expect(result.current.configured).toBe(false);
    expect(result.current.error).toBe("payload error");
    expect(result.current.loading).toBe(true);

    await result.current.refetch();

    expect(buildUrlMock).toHaveBeenLastCalledWith("/api/integrations/shipping/data", {
      project: "atlas",
      range: "7d",
      timezone: "UTC",
      refresh: "1",
    });
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        items: [{ id: "ship-2", title: "Done" }],
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });
});
