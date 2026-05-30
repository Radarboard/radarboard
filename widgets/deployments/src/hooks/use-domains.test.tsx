// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVercelDomains } from "./use-domains";

const apiFetcherMock = vi.fn();
const buildUrlMock = vi.fn();
const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/fetcher", () => ({
  apiFetcher: (...args: unknown[]) => apiFetcherMock(...args),
  buildUrl: (...args: unknown[]) => buildUrlMock(...args),
}));

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

  it("uses the real API key and returns domain data", () => {
    buildUrlMock.mockReturnValue("/api/integrations/vercel/domains?project=my-project");
    swrMock.mockReturnValue({
      data: {
        configured: true,
        domains: [{ name: "example.com" }],
        _fetchedAt: 100,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() => useVercelDomains("my-project"));

    expect(buildUrlMock).toHaveBeenCalledWith("/api/integrations/vercel/domains", {
      project: "my-project",
    });
    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/vercel/domains?project=my-project",
      expect.any(Function),
      {
        refreshInterval: 120_000,
        shouldRetryOnError: false,
        revalidateOnReconnect: false,
        dedupingInterval: 120_000,
      }
    );
    expect(result.current.domains).toEqual([{ name: "example.com" }]);
    expect(result.current.configured).toBe(true);
  });

  it("returns defaults when no data is loaded yet", () => {
    buildUrlMock.mockReturnValue("/api/integrations/vercel/domains?project=my-project");

    const { result } = renderHook(() => useVercelDomains("my-project"));

    expect(result.current.domains).toEqual([]);
    expect(result.current.configured).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
