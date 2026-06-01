// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIntegrationConnections } from "../use-integration-connections";

const useSWRMock = vi.fn();
const mutateSWRMock = vi.fn();
const localMutateMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => useSWRMock(...args),
  mutate: (...args: unknown[]) => mutateSWRMock(...args),
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
    useSWRMock.mockReturnValue({
      data: { connections: [], providers: [] },
      error: null,
      isLoading: false,
      mutate: localMutateMock,
    });
  });

  it("revalidates dashboard data after saving a connection", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useIntegrationConnections());

    await act(async () => {
      await result.current.addOrUpdate(connection);
    });

    expect(localMutateMock).toHaveBeenCalledTimes(1);
    expect(mutateSWRMock).toHaveBeenCalledWith(expect.any(Function), undefined, {
      revalidate: true,
    });

    const matcher = mutateSWRMock.mock.calls[0]?.[0] as (key: unknown) => boolean;
    expect(matcher("/api/integrations/openpanel/data?range=30d")).toBe(true);
    expect(matcher("/api/analytics/data?range=30d")).toBe(true);
    expect(matcher("/api/system/integration-connections")).toBe(false);
  });

  it("revalidates dashboard data after deleting a connection", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useIntegrationConnections());

    await act(async () => {
      await result.current.remove("openpanel::default");
    });

    expect(localMutateMock).toHaveBeenCalledTimes(1);
    expect(mutateSWRMock).toHaveBeenCalledWith(expect.any(Function), undefined, {
      revalidate: true,
    });

    const matcher = mutateSWRMock.mock.calls[0]?.[0] as (key: unknown) => boolean;
    expect(matcher("/api/integrations/openpanel/data?range=30d")).toBe(true);
    expect(matcher("/api/analytics/data?range=30d")).toBe(true);
    expect(matcher("/api/system/integration-connections")).toBe(false);
  });
});
