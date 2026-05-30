// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVercelDeployments } from "./use-builds";

const useEffectiveTimeZoneMock = vi.fn();
const usePollingIntervalMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/use-effective-timezone", () => ({
  useEffectiveTimeZone: () => useEffectiveTimeZoneMock(),
}));

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: () => usePollingIntervalMock(),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

describe("useVercelDeployments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectiveTimeZoneMock.mockReturnValue("America/Toronto");
    usePollingIntervalMock.mockReturnValue(120_000);
  });

  it("builds the SWR key from project, range, and timezone", () => {
    swrMock.mockReturnValue({
      data: {
        configured: true,
        deployments: [{ id: "dep_1" }],
        projects: [{ id: "project_1" }],
        _fetchedAt: 123,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });

    const { result } = renderHook(() => useVercelDeployments("goshuin-atlas", "7d"));

    expect(swrMock).toHaveBeenCalledWith(
      "/api/integrations/vercel/deployments?project=goshuin-atlas&range=7d&timezone=America%2FToronto",
      expect.any(Function),
      { refreshInterval: 120_000, shouldRetryOnError: false }
    );
    expect(result.current.deployments).toEqual([{ id: "dep_1" }]);
    expect(result.current.projects).toEqual([{ id: "project_1" }]);
    expect(result.current.fetchedAt).toBe(123);
  });

  it("refetches with the refresh flag and stores the fresh payload without revalidation", async () => {
    const mutateMock = vi.fn(async () => undefined);
    swrMock.mockReturnValue({
      data: {
        configured: true,
        deployments: [],
        projects: [],
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
              deployments: [{ id: "dep_fresh" }],
              projects: [],
              _fetchedAt: 456,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
      )
    );

    const { result } = renderHook(() => useVercelDeployments("goshuin-atlas", "30d"));

    await result.current.refetch();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/integrations/vercel/deployments?project=goshuin-atlas&range=30d&timezone=America%2FToronto&refresh=1"
    );
    expect(mutateMock).toHaveBeenCalledWith(
      {
        configured: true,
        deployments: [{ id: "dep_fresh" }],
        projects: [],
        _fetchedAt: 456,
      },
      { revalidate: false }
    );
  });
});
