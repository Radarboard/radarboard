// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRoadmap } from "./use-roadmap";

const apiFetcher = vi.fn();
const buildUrl = vi.fn();
const usePollingInterval = vi.fn();
const useSWR = vi.fn();

vi.mock("@radarboard/hooks/fetcher", () => ({
  apiFetcher: (...args: unknown[]) => apiFetcher(...args),
  buildUrl: (...args: unknown[]) => buildUrl(...args),
}));

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: (...args: unknown[]) => usePollingInterval(...args),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => useSWR(...args),
}));

describe("useRoadmap", () => {
  it("builds the swr key and exposes safe defaults", () => {
    buildUrl.mockImplementation(
      (_route: string, params: Record<string, unknown>) =>
        `/api/integrations/linear/roadmap?project=${params.project ?? ""}`
    );
    usePollingInterval.mockReturnValue(15000);
    useSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate: vi.fn(),
    });

    const { result } = renderHook(() => useRoadmap("atlas"));

    expect(usePollingInterval).toHaveBeenCalledWith("roadmap");
    expect(buildUrl).toHaveBeenCalledWith("/api/integrations/linear/roadmap", { project: "atlas" });
    expect(useSWR).toHaveBeenCalledWith(
      "/api/integrations/linear/roadmap?project=atlas",
      expect.any(Function),
      { refreshInterval: 15000, shouldRetryOnError: false }
    );
    expect(result.current).toMatchObject({
      projects: [],
      inProgressIssues: [],
      configured: false,
      fetchedAt: null,
      loading: true,
      error: null,
    });
  });

  it("forces a refresh and updates swr without revalidation", async () => {
    buildUrl.mockImplementation((_route: string, params: Record<string, unknown>) => {
      const search = new URLSearchParams();
      if (params.project) search.set("project", String(params.project));
      if (params.refresh) search.set("refresh", String(params.refresh));
      return `/api/integrations/linear/roadmap?${search.toString()}`;
    });
    usePollingInterval.mockReturnValue(5000);
    const mutate = vi.fn();
    const fresh = {
      configured: false,
      projects: [{ id: "p-1", name: "Launch" }],
      inProgressIssues: [{ id: "issue-1" }],
      _fetchedAt: 123,
    };
    apiFetcher.mockResolvedValue(fresh);
    useSWR.mockReturnValue({
      data: fresh,
      error: undefined,
      isLoading: false,
      mutate,
    });

    const { result } = renderHook(() => useRoadmap("atlas"));

    await result.current.refetch();

    expect(apiFetcher).toHaveBeenCalledWith(
      "/api/integrations/linear/roadmap?project=atlas&refresh=1"
    );
    expect(mutate).toHaveBeenCalledWith(fresh, { revalidate: false });
    expect(result.current).toMatchObject({
      configured: false,
      projects: [{ id: "p-1", name: "Launch" }],
      inProgressIssues: [{ id: "issue-1" }],
      fetchedAt: 123,
    });
  });
});
