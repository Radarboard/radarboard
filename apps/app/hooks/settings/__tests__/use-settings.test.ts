// @vitest-environment jsdom

import { API_ROUTES } from "@radarboard/types/api-routes";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import { BASIC_3X3, getSortedCells } from "@radarboard/widget-engine/layouts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockToastError = vi.fn();
const mockSWRMutate = vi.fn(() => Promise.resolve(undefined));
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));
vi.mock("swr", () => ({
  mutate: (...args: unknown[]) => mockSWRMutate(...args),
}));

import { resetSettingsStoreForTesting } from "@/modules/settings/store/settings-store";
import { useSettings } from "../use-settings";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("useSettings", () => {
  beforeEach(() => {
    // Reset singleton store + load guard so each test starts fresh
    resetSettingsStoreForTesting();
    mockFetch.mockReset();
    mockToastError.mockReset();
    mockSWRMutate.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches project order on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectOrder: ["a", "b", "c"] }),
    });

    const { result } = renderHook(() => useSettings());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projectOrder).toEqual(["a", "b", "c"]);
    expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.settings);
  });

  it("returns empty array when fetch returns empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectOrder: [] }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projectOrder).toEqual([]);
  });

  it("handles fetch failure gracefully", async () => {
    // Use mockRejectedValue (not Once) so retries also fail
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useSettings());

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10_000 }
    );

    expect(result.current.projectOrder).toEqual([]);
    // No toast — settings silently fall back to defaults on failure
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("handles non-ok response", async () => {
    // Use mockResolvedValue (not Once) so retries also get non-ok
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useSettings());

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10_000 }
    );

    expect(result.current.projectOrder).toEqual([]);
    // No toast — settings silently fall back to defaults on failure
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("migrates legacy global widget layout into the All Projects pseudo-project", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projectOrder: ["front-end-checklist"],
        widgetLayout: {
          layout: {
            slot1: "shipping",
            slot2: "revenue",
          },
          configs: {},
        },
        projectIntegrations: {},
      }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const [firstCell, secondCell] = getSortedCells(BASIC_3X3.cells);
    expect(result.current.widgetLayout.projectLayouts?.[ALL_PROJECTS_SLUG]?.pages?.[0]?.slug).toBe(
      "overview"
    );
    expect(
      result.current.widgetLayout.projectLayouts?.[ALL_PROJECTS_SLUG]?.pages?.[0]?.widgetLayouts?.[
        "basic-3x3"
      ]?.[firstCell?.id ?? ""]
    ).toBeUndefined();
    expect(
      result.current.widgetLayout.projectLayouts?.[ALL_PROJECTS_SLUG]?.pages?.[0]?.widgetLayouts?.[
        "basic-3x3"
      ]?.[secondCell?.id ?? ""]
    ).toBeUndefined();
  });

  it("normalizes page-based configs and de-duplicates page slugs", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projectOrder: [],
        widgetLayout: {
          configs: {},
          projectLayouts: {
            [ALL_PROJECTS_SLUG]: {
              pages: [
                {
                  name: "Executive",
                  slug: "overview",
                  layoutId: "basic-3x3",
                  widgetLayouts: {
                    "basic-3x3": {
                      slot1: "analytics",
                    },
                  },
                },
                {
                  name: "Operations",
                  slug: "overview",
                  layoutId: "basic-3x3",
                  widgetLayouts: {
                    "basic-3x3": {
                      slot1: "shipping",
                    },
                  },
                },
              ],
            },
          },
        },
        projectIntegrations: {},
      }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.widgetLayout.projectLayouts?.[ALL_PROJECTS_SLUG]?.pages).toMatchObject([
      { slug: "overview" },
      { slug: "overview-2" },
    ]);
  });

  it("preserves persisted widget modal preferences when settings load", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projectOrder: [],
        widgetLayout: {
          configs: {},
          modalPrefs: {
            shipping: {
              "shipping.item": "lg",
            },
          },
        },
        projectIntegrations: {},
      }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.widgetLayout.modalPrefs).toEqual({
      shipping: {
        "shipping.item": "lg",
      },
    });
  });

  it("optimistically updates project order", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectOrder: ["a", "b"] }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock the POST that the debounce will trigger
    mockFetch.mockResolvedValueOnce({ ok: true });

    act(() => {
      result.current.updateProjectOrder(["b", "a"]);
    });

    // Optimistic update is immediate
    expect(result.current.projectOrder).toEqual(["b", "a"]);
  });

  it("sends POST after debounce period", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectOrder: ["a", "b"] }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockFetch.mockResolvedValueOnce({ ok: true });

    act(() => {
      result.current.updateProjectOrder(["b", "a"]);
    });

    // Wait for debounce (300ms) + POST
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.settings, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectOrder: ["b", "a"] }),
        });
      },
      { timeout: 1000 }
    );
  });

  it("optimistically updates project integrations and revalidates integration routes after save", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projectOrder: [],
        widgetLayout: null,
        projectIntegrations: {},
      }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockFetch.mockResolvedValueOnce({ ok: true });

    act(() => {
      result.current.updateProjectIntegrations({
        "my-project": {
          website: {
            "openPanel.projectId": "op_123",
          },
        },
      });
    });

    expect(result.current.projectIntegrations).toEqual({
      "my-project": {
        website: {
          "openPanel.projectId": "op_123",
        },
      },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectIntegrations: {
            "my-project": {
              website: {
                "openPanel.projectId": "op_123",
              },
            },
          },
        }),
      });

      expect(mockSWRMutate).toHaveBeenCalledWith(expect.any(Function), undefined, {
        revalidate: true,
      });
    });
  });

  it("reverts on POST failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projectOrder: ["a", "b"] }),
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // POST will fail
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    act(() => {
      result.current.updateProjectOrder(["b", "a"]);
    });

    expect(result.current.projectOrder).toEqual(["b", "a"]);

    // Wait for debounce + revert
    await waitFor(
      () => {
        expect(result.current.projectOrder).toEqual(["a", "b"]);
      },
      { timeout: 1000 }
    );

    expect(mockToastError).toHaveBeenCalledWith("Failed to save project order", expect.any(Object));
  });

  it("does not throw when fetch resolves after unmount", async () => {
    let resolveSettingsFetch: ((value: unknown) => void) | undefined;

    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSettingsFetch = resolve;
        })
    );

    const { result, unmount } = renderHook(() => useSettings());

    expect(result.current.isLoading).toBe(true);

    // Unmount before fetch completes
    unmount();

    // Resolve the fetch after unmount -- should not throw
    await act(async () => {
      resolveSettingsFetch?.({
        ok: true,
        json: async () => ({ projectOrder: ["x"] }),
      });
    });

    // result.current holds the last rendered snapshot (before unmount)
    expect(result.current.projectOrder).toEqual([]);
  });
});
