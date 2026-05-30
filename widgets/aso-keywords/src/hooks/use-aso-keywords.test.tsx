// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAsoKeywords } from "./use-aso-keywords";

const apiFetcherMock = vi.fn();
const buildUrlMock = vi.fn();
const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/fetcher", () => ({
  apiFetcher: (...args: unknown[]) => apiFetcherMock(...args),
  buildUrl: (...args: unknown[]) => buildUrlMock(...args),
}));

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: () => usePollingIntervalMock(),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

describe("useAsoKeywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePollingIntervalMock.mockReturnValue(90_000);
    buildUrlMock.mockReturnValue("/api/integrations/astro/keywords?project=radarboard&store=us");
  });

  it("builds the SWR key from project and store filters", () => {
    swrMock.mockReturnValue({
      data: {
        configured: true,
        keywords: [{ keyword: "radarboard" }],
        _fetchedAt: 123,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() => useAsoKeywords("radarboard", "us"));

    expect(swrMock).toHaveBeenCalledWith(expect.any(String), expect.any(Function), {
      refreshInterval: 90_000,
      shouldRetryOnError: false,
    });
    expect(buildUrlMock).toHaveBeenCalledWith("/api/integrations/astro/keywords", {
      project: "radarboard",
      store: "us",
    });
    expect(result.current.data).toMatchObject({
      configured: true,
      keywords: [{ keyword: "radarboard" }],
    });
  });

  it("refetches with the refresh flag and preserves stale/configured metadata", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: true,
        _stale: true,
        _fetchedAt: 123,
      },
      error: null,
      isLoading: false,
      mutate: mutateMock,
    });
    apiFetcherMock.mockResolvedValue({
      configured: true,
      keywords: [{ keyword: "updated" }],
      _stale: false,
      _fetchedAt: 456,
    });

    const { result } = renderHook(() => useAsoKeywords("radarboard", null));

    await result.current.refetch();

    expect(buildUrlMock).toHaveBeenLastCalledWith("/api/integrations/astro/keywords", {
      project: "radarboard",
      store: null,
      refresh: "1",
    });
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        keywords: [{ keyword: "updated" }],
        _stale: false,
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });
});
