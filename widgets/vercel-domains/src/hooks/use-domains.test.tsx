// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVercelDomains } from "./use-domains";

const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: (...args: unknown[]) => usePollingIntervalMock(...args),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

describe("useVercelDomains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePollingIntervalMock.mockReturnValue(120_000);
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("builds the SWR key and returns domain data", () => {
    swrMock.mockReturnValue({
      data: {
        configured: true,
        domains: [{ name: "radarboard.app" }],
        _fetchedAt: 123,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() => useVercelDomains("radarboard"));

    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/vercel/domains?project=radarboard",
      expect.any(Function),
      {
        refreshInterval: 120_000,
        shouldRetryOnError: false,
        revalidateOnReconnect: false,
        dedupingInterval: 120_000,
      }
    );
    expect(result.current.domains).toEqual([{ name: "radarboard.app" }]);
    expect(result.current.fetchedAt).toBe(123);
  });

  it("refetches with the refresh flag and updates via mutate", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: true,
        domains: [],
        _fetchedAt: 123,
      },
      error: null,
      isLoading: false,
      mutate: mutateMock,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              configured: true,
              domains: [{ name: "fresh-domain.app" }],
              _fetchedAt: 456,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
      )
    );

    const { result } = renderHook(() => useVercelDomains("radarboard"));

    await result.current.refetch();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/integrations/vercel/domains?project=radarboard&refresh=1"
    );
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        domains: [{ name: "fresh-domain.app" }],
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });

  it("returns defaults when no data is loaded yet", () => {
    const { result } = renderHook(() => useVercelDomains("my-project"));

    expect(result.current.configured).toBe(false);
    expect(result.current.domains).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
