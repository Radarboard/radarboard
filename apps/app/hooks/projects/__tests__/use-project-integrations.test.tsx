// @vitest-environment jsdom

import { API_ROUTES } from "@radarboard/types/api-routes";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
const mockSWRMutate = vi.fn(() => Promise.resolve(undefined));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

vi.mock("swr", () => ({
  mutate: (...args: unknown[]) => mockSWRMutate(...args),
}));

import { resetSettingsStoreForTesting } from "@/modules/settings/store/settings-store";
import { useProjectIntegrations } from "../use-project-integrations";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("useProjectIntegrations", () => {
  beforeEach(() => {
    resetSettingsStoreForTesting();
    mockFetch.mockReset();
    mockToastError.mockReset();
    mockToastInfo.mockReset();
    mockSWRMutate.mockReset();
  });

  it("merges sequential integration updates into one project config", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        projectOrder: [],
        widgetLayout: null,
        projectIntegrations: {},
      }),
    });

    const { result } = renderHook(() => useProjectIntegrations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateIntegration("@@projects", "_", "ids", ["launch-monitor"]);
      result.current.updateIntegration("@@proj_launch-monitor", "_", "name", "Launch Monitor");
      result.current.updateIntegration("@@proj_launch-monitor", "_", "color", "#5b8af5");
    });

    expect(result.current.integrations).toEqual({
      "@@projects": {
        _: {
          ids: ["launch-monitor"],
        },
      },
      "@@proj_launch-monitor": {
        _: {
          name: "Launch Monitor",
          color: "#5b8af5",
        },
      },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectIntegrations: {
            "@@projects": {
              _: {
                ids: ["launch-monitor"],
              },
            },
            "@@proj_launch-monitor": {
              _: {
                name: "Launch Monitor",
                color: "#5b8af5",
              },
            },
          },
        }),
      });
    });
  });
});
