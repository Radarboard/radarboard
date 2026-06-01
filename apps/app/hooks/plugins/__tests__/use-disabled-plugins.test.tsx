// @vitest-environment jsdom

import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDisabledPlugins,
  useDisabledPluginsState,
  useSyncDisabledPluginIdsCache,
} from "../use-disabled-plugins";

vi.mock("@radarboard/plugin-sdk/host", () => ({
  getPluginToken: vi.fn(async () => "test-token"),
}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: () => [
    { id: "rss-reader" },
    { id: "notes" },
    { id: "tasks" },
    { id: "bookmarks" },
  ],
}));

let mockIsDemoMode = false;

vi.mock("@radarboard/hooks/use-demo-mode", () => ({
  useDemoMode: () => ({ isDemoMode: mockIsDemoMode }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createWrapper() {
  const cache = new Map();

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SWRConfig, { value: { provider: () => cache } }, children);
  };
}

describe("useDisabledPlugins", () => {
  beforeEach(() => {
    mockIsDemoMode = false;
    vi.mocked(getPluginToken).mockResolvedValue("test-token");
    mockFetch.mockReset();
  });

  it("reuses cached disabled plugin state across mounts", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: JSON.stringify(["rss-reader"]) }),
    });

    const wrapper = createWrapper();
    const firstHook = renderHook(() => useDisabledPlugins(), { wrapper });

    await waitFor(() => {
      expect(firstHook.result.current.has("rss-reader")).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    firstHook.unmount();

    const secondHook = renderHook(() => useDisabledPlugins(), { wrapper });

    expect(secondHook.result.current.has("rss-reader")).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("updates the shared cache optimistically when a plugin is toggled", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: JSON.stringify(["rss-reader"]) }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDisabledPluginsState(), { wrapper });

    await waitFor(() => {
      expect(result.current.disabledIds.has("rss-reader")).toBe(true);
    });

    act(() => {
      result.current.setPluginEnabled("rss-reader", true);
    });

    await waitFor(() => {
      expect(result.current.disabledIds.has("rss-reader")).toBe(false);
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/plugins/data",
      expect.objectContaining({
        method: "PUT",
      })
    );
  });

  it("can hydrate the disabled plugin cache after onboarding persists plugin state", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: null }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDisabledPlugins(), { wrapper });
    const syncHook = renderHook(() => useSyncDisabledPluginIdsCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.has("rss-reader")).toBe(true);
    });

    await act(async () => {
      await syncHook.result.current([]);
    });

    await waitFor(() => {
      expect(result.current.has("rss-reader")).toBe(false);
    });
  });

  it("enables demo plugins without persisting plugin preferences", async () => {
    mockIsDemoMode = true;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: null }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDisabledPlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.has("rss-reader")).toBe(true);
    });

    expect(result.current.has("tasks")).toBe(false);
    expect(result.current.has("notes")).toBe(false);
    expect(result.current.has("bookmarks")).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
