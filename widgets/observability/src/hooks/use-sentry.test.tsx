// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSentry } from "./use-sentry";

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

describe("useSentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectiveTimeZoneMock.mockReturnValue("UTC");
    usePollingIntervalMock.mockReturnValue(60_000);
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("returns defaults when no data is loaded yet", () => {
    buildUrlMock.mockReturnValue(
      "/api/integrations/sentry/data?project=my-project&range=30d&timezone=UTC"
    );

    const { result } = renderHook(() => useSentry("my-project", "30d"));

    expect(result.current.configured).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("uses the real API and returns sentry data", () => {
    buildUrlMock.mockReturnValue(
      "/api/integrations/sentry/data?project=my-project&range=30d&timezone=UTC"
    );
    swrMock.mockReturnValue({
      data: {
        configured: true,
        sentry: { unresolvedCount: 5, errorTrend: [], issues: [] },
        _fetchedAt: 200,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() => useSentry("my-project", "30d"));

    expect(buildUrlMock).toHaveBeenCalledWith("/api/integrations/sentry/data", {
      project: "my-project",
      range: "30d",
      timezone: "UTC",
    });
    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/sentry/data?project=my-project&range=30d&timezone=UTC",
      expect.any(Function),
      { refreshInterval: 60_000, shouldRetryOnError: false }
    );
    expect(result.current.data).toEqual({
      unresolvedCount: 5,
      errorTrend: [],
      issues: [],
    });
    expect(result.current.configured).toBe(true);
  });
});
