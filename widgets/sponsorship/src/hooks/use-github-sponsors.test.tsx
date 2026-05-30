// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGitHubSponsors } from "./use-github-sponsors";

const apiFetcherMock = vi.fn();
const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/fetcher", () => ({
  apiFetcher: (...args: unknown[]) => apiFetcherMock(...args),
}));

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: (...args: unknown[]) => usePollingIntervalMock(...args),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

describe("useGitHubSponsors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePollingIntervalMock.mockReturnValue(60_000);
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("disables the query when the hook is disabled", () => {
    renderHook(() => useGitHubSponsors("openai", false));

    expect(swrMock).toHaveBeenCalledWith(null, expect.any(Function), {
      refreshInterval: 60_000,
      shouldRetryOnError: false,
    });
  });

  it("parses github sponsors data and refetches", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: true,
        stats: { monthlyIncome: 4500, sponsorCount: 3, currency: "USD" },
        sponsors: [{ login: "alice" }],
        tiers: [{ id: "tier-1" }],
        goal: { title: "Open source", targetValue: 10000, percentComplete: 45 },
        limitedAccess: true,
        _fetchedAt: 77,
      },
      error: null,
      isLoading: true,
      mutate: mutateMock,
    });
    apiFetcherMock.mockResolvedValue({
      configured: true,
      stats: { monthlyIncome: 5000, sponsorCount: 4, currency: "USD" },
      sponsors: [],
      tiers: [],
      goal: null,
      limitedAccess: false,
    });

    const { result } = renderHook(() => useGitHubSponsors("openai"));

    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/github-sponsors/data?login=openai",
      expect.any(Function),
      { refreshInterval: 60_000, shouldRetryOnError: false }
    );
    expect(result.current.data).toEqual({
      stats: { monthlyIncome: 4500, sponsorCount: 3, currency: "USD" },
      sponsors: [{ login: "alice" }],
      tiers: [{ id: "tier-1" }],
      goal: { title: "Open source", targetValue: 10000, percentComplete: 45 },
      limitedAccess: true,
    });

    await result.current.refetch();

    expect(apiFetcherMock).toHaveBeenCalledWith(
      "/api/integrations/github-sponsors/data?login=openai&refresh=1"
    );
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        stats: { monthlyIncome: 5000, sponsorCount: 4, currency: "USD" },
        sponsors: [],
        tiers: [],
        goal: null,
        limitedAccess: false,
      },
      { revalidate: false }
    );
  });

  it("uses the base route when login is missing and refetches without a login param", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: false,
      },
      error: null,
      isLoading: false,
      mutate: mutateMock,
    });
    apiFetcherMock.mockResolvedValue({ configured: true, stats: { monthlyIncome: 0 } });

    const { result } = renderHook(() => useGitHubSponsors(null, true));

    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/github-sponsors/data",
      expect.any(Function),
      { refreshInterval: 60_000, shouldRetryOnError: false }
    );

    await result.current.refetch();

    expect(apiFetcherMock).toHaveBeenCalledWith("/api/integrations/github-sponsors/data?refresh=1");
  });
});
