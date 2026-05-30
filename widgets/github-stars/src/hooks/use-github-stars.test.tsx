// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGitHubStars } from "./use-github-stars";

const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();
const buildGitHubStarsUrlMock = vi.fn();

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: (...args: unknown[]) => usePollingIntervalMock(...args),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

vi.mock("../repo-query", () => ({
  buildGitHubStarsUrl: (...args: unknown[]) => buildGitHubStarsUrlMock(...args),
}));

describe("useGitHubStars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePollingIntervalMock.mockReturnValue(30_000);
    buildGitHubStarsUrlMock.mockReturnValue("/api/integrations/github/stars?project=atlas");
    swrMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
  });

  it("uses the repo query helper for the swr key", () => {
    const { result } = renderHook(() =>
      useGitHubStars("atlas", [{ owner: "openai", repo: "codex" }])
    );

    expect(buildGitHubStarsUrlMock).toHaveBeenCalledWith("atlas", [
      { owner: "openai", repo: "codex" },
    ]);
    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/github/stars?project=atlas",
      expect.any(Function),
      { refreshInterval: 30_000, shouldRetryOnError: false }
    );
    expect(result.current.data).toBeNull();
  });

  it("returns fetched data and refetches with refresh", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        repos: [{ fullName: "openai/codex" }],
        totalStars: 100,
        totalForks: 5,
        starHistory: [],
        _fetchedAt: 123,
      },
      error: { message: "boom" },
      isLoading: true,
      mutate: mutateMock,
    });
    buildGitHubStarsUrlMock
      .mockReturnValueOnce("/api/integrations/github/stars?project=atlas")
      .mockReturnValueOnce("/api/integrations/github/stars?project=atlas&refresh=1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          repos: [{ fullName: "openai/codex" }],
          totalStars: 101,
          totalForks: 5,
          starHistory: [],
          _fetchedAt: 456,
        }),
      })
    );

    const { result } = renderHook(() =>
      useGitHubStars("atlas", [{ owner: "openai", repo: "codex" }])
    );

    expect(result.current.fetchedAt).toBe(123);
    expect(result.current.error).toBe("boom");

    await result.current.refetch();

    expect(buildGitHubStarsUrlMock).toHaveBeenLastCalledWith(
      "atlas",
      [{ owner: "openai", repo: "codex" }],
      true
    );
    expect(mutateMock).toHaveBeenCalledWith(
      {
        repos: [{ fullName: "openai/codex" }],
        totalStars: 101,
        totalForks: 5,
        starHistory: [],
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });
});
