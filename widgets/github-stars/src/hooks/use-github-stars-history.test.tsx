// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGitHubStarsHistory } from "./use-github-stars-history";

const useEffectiveTimeZoneMock = vi.fn();
const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();
const buildGitHubStarsHistoryUrlMock = vi.fn();

vi.mock("@radarboard/hooks/use-effective-timezone", () => ({
  useEffectiveTimeZone: (...args: unknown[]) => useEffectiveTimeZoneMock(...args),
}));

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: (...args: unknown[]) => usePollingIntervalMock(...args),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

vi.mock("../repo-query", () => ({
  buildGitHubStarsHistoryUrl: (...args: unknown[]) => buildGitHubStarsHistoryUrlMock(...args),
}));

describe("useGitHubStarsHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectiveTimeZoneMock.mockReturnValue("UTC");
    usePollingIntervalMock.mockReturnValue(30_000);
    buildGitHubStarsHistoryUrlMock.mockReturnValue(
      "/api/integrations/github/stars-history?project=atlas&range=30d&timezone=UTC"
    );
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("builds the history key with range and timezone", () => {
    const { result } = renderHook(() =>
      useGitHubStarsHistory("atlas", [{ owner: "openai", repo: "codex" }], "30d")
    );

    expect(buildGitHubStarsHistoryUrlMock).toHaveBeenCalledWith("atlas", "30d", "UTC", [
      { owner: "openai", repo: "codex" },
    ]);
    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/github/stars-history?project=atlas&range=30d&timezone=UTC",
      expect.any(Function),
      {
        refreshInterval: 30_000,
        shouldRetryOnError: false,
        dedupingInterval: 30_000,
        revalidateOnReconnect: false,
      }
    );
    expect(result.current.data).toBeNull();
  });

  it("refetches history with refresh=1 and surfaces errors", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        aggregateDaily: [],
        repoDaily: {},
        aggregateAddedDaily: [],
        repoAddedDaily: {},
        repos: [],
        latestSyncAt: 123,
        _fetchedAt: 123,
      },
      error: { message: "history failed" },
      isLoading: true,
      mutate: mutateMock,
    });
    buildGitHubStarsHistoryUrlMock
      .mockReturnValueOnce(
        "/api/integrations/github/stars-history?project=atlas&range=30d&timezone=UTC"
      )
      .mockReturnValueOnce(
        "/api/integrations/github/stars-history?project=atlas&range=30d&timezone=UTC&refresh=1"
      );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          aggregateDaily: [],
          repoDaily: {},
          aggregateAddedDaily: [],
          repoAddedDaily: {},
          repos: [],
          latestSyncAt: 456,
          _fetchedAt: 456,
        }),
      })
    );

    const { result } = renderHook(() =>
      useGitHubStarsHistory("atlas", [{ owner: "openai", repo: "codex" }], "30d")
    );

    expect(result.current.error).toBe("history failed");

    await result.current.refetch();

    expect(buildGitHubStarsHistoryUrlMock).toHaveBeenLastCalledWith(
      "atlas",
      "30d",
      "UTC",
      [{ owner: "openai", repo: "codex" }],
      true
    );
    expect(mutateMock).toHaveBeenCalledWith(
      {
        aggregateDaily: [],
        repoDaily: {},
        aggregateAddedDaily: [],
        repoAddedDaily: {},
        repos: [],
        latestSyncAt: 456,
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });

  it("surfaces api-provided error messages from the fetcher", async () => {
    buildGitHubStarsHistoryUrlMock.mockReturnValue(
      "/api/integrations/github/stars-history?project=atlas&range=all&timezone=UTC"
    );
    swrMock.mockReturnValue({
      data: undefined,
      error: new Error("upstream exploded"),
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() => useGitHubStarsHistory("atlas", [], "all"));

    expect(result.current.error).toBe("upstream exploded");
  });

  it("throws payload errors when a refetch request fails", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        aggregateDaily: [],
        repoDaily: {},
        aggregateAddedDaily: [],
        repoAddedDaily: {},
        repos: [],
        latestSyncAt: 100,
        _fetchedAt: 100,
      },
      error: null,
      isLoading: false,
      mutate: mutateMock,
    });
    buildGitHubStarsHistoryUrlMock
      .mockReturnValueOnce(
        "/api/integrations/github/stars-history?project=atlas&range=30d&timezone=UTC"
      )
      .mockReturnValueOnce(
        "/api/integrations/github/stars-history?project=atlas&range=30d&timezone=UTC&refresh=1"
      );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "history refresh failed" }),
      })
    );

    const { result } = renderHook(() => useGitHubStarsHistory("atlas", [], "30d"));

    await expect(result.current.refetch()).rejects.toThrow("history refresh failed");
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
