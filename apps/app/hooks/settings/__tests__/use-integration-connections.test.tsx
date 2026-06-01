// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIntegrationConnections } from "../use-integration-connections";

const useSWRMock = vi.fn();
const mutateSWRMock = vi.fn();
const localMutateMock = vi.fn();
const fetchMock = vi.fn();
let dashboardCache: Map<string, unknown>;

vi.mock("swr", () => ({
  default: (...args: unknown[]) => useSWRMock(...args),
  useSWRConfig: () => ({
    cache: dashboardCache,
    mutate: (...args: unknown[]) => mutateSWRMock(...args),
  }),
}));

vi.stubGlobal("fetch", fetchMock);

const connection = {
  id: "openpanel::default",
  provider: "openpanel",
  name: "OpenPanel",
  credentialKey: "openpanel",
  enabled: true,
  isDefault: true,
  capabilities: [{ id: "analytics", enabled: true }],
};

describe("useIntegrationConnections", () => {
  beforeEach(() => {
    useSWRMock.mockReset();
    mutateSWRMock.mockReset();
    localMutateMock.mockReset();
    fetchMock.mockReset();
    localMutateMock.mockResolvedValue(undefined);
    mutateSWRMock.mockResolvedValue(undefined);
    dashboardCache = new Map([
      ["/api/integrations/openpanel/data?range=30d", {}],
      ["/api/analytics/data?range=30d", {}],
      ["/api/system/integration-connections", {}],
    ]);
    useSWRMock.mockReturnValue({
      data: { connections: [], providers: [] },
      error: null,
      isLoading: false,
      mutate: localMutateMock,
    });
  });

  it("revalidates dashboard data after saving a connection", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ configured: true }),
      };
    });

    const { result } = renderHook(() => useIntegrationConnections());

    await act(async () => {
      await result.current.addOrUpdate(connection);
    });

    expect(localMutateMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/integrations/openpanel/data?range=30d&refresh=1");
    expect(fetchMock).toHaveBeenCalledWith("/api/analytics/data?range=30d&refresh=1");
    expect(mutateSWRMock).toHaveBeenCalledWith(
      "/api/integrations/openpanel/data?range=30d",
      { configured: true },
      { populateCache: true, revalidate: false }
    );
    expect(mutateSWRMock).toHaveBeenCalledWith(
      "/api/analytics/data?range=30d",
      { configured: true },
      { populateCache: true, revalidate: false }
    );
    expect(mutateSWRMock).not.toHaveBeenCalledWith(
      "/api/system/integration-connections",
      expect.anything(),
      expect.anything()
    );
  });

  it("revalidates dashboard data after deleting a connection", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ configured: true }),
      };
    });

    const { result } = renderHook(() => useIntegrationConnections());

    await act(async () => {
      await result.current.remove("openpanel::default");
    });

    expect(localMutateMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/integrations/openpanel/data?range=30d&refresh=1");
    expect(fetchMock).toHaveBeenCalledWith("/api/analytics/data?range=30d&refresh=1");
    expect(mutateSWRMock).toHaveBeenCalledWith(
      "/api/integrations/openpanel/data?range=30d",
      { configured: true },
      { populateCache: true, revalidate: false }
    );
    expect(mutateSWRMock).toHaveBeenCalledWith(
      "/api/analytics/data?range=30d",
      { configured: true },
      { populateCache: true, revalidate: false }
    );
    expect(mutateSWRMock).not.toHaveBeenCalledWith(
      "/api/system/integration-connections",
      expect.anything(),
      expect.anything()
    );
  });
});
