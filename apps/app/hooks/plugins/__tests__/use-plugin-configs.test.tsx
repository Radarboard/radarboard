// @vitest-environment jsdom

import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePluginConfigState, usePluginConfigs } from "../use-plugin-configs";

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: () => [{ id: "rss-reader" }, { id: "notes" }],
}));

vi.mock("@radarboard/plugin-sdk/host", () => ({
  getPluginToken: vi.fn(async () => "test-token"),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createWrapper() {
  const cache = new Map();

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(SWRConfig, { value: { provider: () => cache } }, children);
  };
}

describe("usePluginConfigs", () => {
  beforeEach(() => {
    vi.mocked(getPluginToken).mockResolvedValue("test-token");
    mockFetch.mockReset();
  });

  it("reuses cached plugin configs across mounts", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: JSON.stringify({ shortcut: "Mod+R" }) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: null }),
      });

    const wrapper = createWrapper();
    const firstHook = renderHook(() => usePluginConfigs(), { wrapper });

    await waitFor(() => {
      expect(firstHook.result.current.get("rss-reader")?.shortcut).toBe("Mod+R");
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    firstHook.unmount();

    const secondHook = renderHook(() => usePluginConfigs(), { wrapper });

    expect(secondHook.result.current.get("rss-reader")?.shortcut).toBe("Mod+R");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("updates the shared cache optimistically when a config changes", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: JSON.stringify({ shortcut: "Mod+R" }) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    const wrapper = createWrapper();
    const configsHook = renderHook(() => usePluginConfigs(), { wrapper });
    const stateHook = renderHook(() => usePluginConfigState("rss-reader"), { wrapper });

    await waitFor(() => {
      expect(stateHook.result.current.config.shortcut).toBe("Mod+R");
    });

    act(() => {
      stateHook.result.current.updateConfig((prev) => ({
        ...prev,
        shortcut: "Mod+Shift+R",
      }));
    });

    await waitFor(() => {
      expect(configsHook.result.current.get("rss-reader")?.shortcut).toBe("Mod+Shift+R");
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/plugins/data",
      expect.objectContaining({
        method: "PUT",
      })
    );
  });
});
