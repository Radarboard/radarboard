// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOpenCollective } from "./use-open-collective";

const apiFetcherMock = vi.fn();
const useEffectiveTimeZoneMock = vi.fn();
const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/fetcher", () => ({
  apiFetcher: (...args: unknown[]) => apiFetcherMock(...args),
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

describe("useOpenCollective", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectiveTimeZoneMock.mockReturnValue("UTC");
    usePollingIntervalMock.mockReturnValue(90_000);
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("disables the query when no slug exists", () => {
    const { result } = renderHook(() => useOpenCollective(null, "30d"));

    expect(swrMock).toHaveBeenCalledWith(null, expect.any(Function), {
      refreshInterval: 90_000,
      shouldRetryOnError: false,
    });
    expect(result.current.data).toBeNull();
  });

  it("parses stats payloads and refetches with refresh", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: true,
        stats: { yearlyBudget: 240000, balance: 120000, currency: "USD", backersCount: 2 },
        recentTransactions: [{ id: "txn-1" }],
        topMembers: [{ id: "member-1" }],
        _fetchedAt: 123,
      },
      error: { message: "ignored" },
      isLoading: true,
      mutate: mutateMock,
    });
    apiFetcherMock.mockResolvedValue({
      configured: true,
      stats: { yearlyBudget: 360000, balance: 180000, currency: "USD", backersCount: 4 },
      recentTransactions: [],
      topMembers: [],
    });

    const { result } = renderHook(() => useOpenCollective("radarboard", "7d"));

    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/open-collective/data?slug=radarboard&range=7d&timezone=UTC",
      expect.any(Function),
      { refreshInterval: 90_000, shouldRetryOnError: false }
    );
    expect(result.current.data).toEqual({
      stats: { yearlyBudget: 240000, balance: 120000, currency: "USD", backersCount: 2 },
      recentTransactions: [{ id: "txn-1" }],
      topMembers: [{ id: "member-1" }],
    });
    expect(result.current.error).toBe("ignored");

    await result.current.refetch();

    expect(apiFetcherMock).toHaveBeenCalledWith(
      "/api/integrations/open-collective/data?slug=radarboard&range=7d&timezone=UTC&refresh=1"
    );
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        stats: { yearlyBudget: 360000, balance: 180000, currency: "USD", backersCount: 4 },
        recentTransactions: [],
        topMembers: [],
      },
      { revalidate: false }
    );
  });
});
