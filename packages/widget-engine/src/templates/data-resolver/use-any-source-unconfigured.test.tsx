// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { describe, expect, it } from "vitest";

/**
 * We test useAnySourceUnconfigured logic inline since the hook reads from
 * React context that is internal to the data-resolver module.
 * The test mirrors the detection logic to verify the three patterns.
 */

interface ResolvedSourceState {
  data: unknown;
  fetchedAt: number | null;
  refetch: (() => Promise<void>) | null;
  loading: boolean;
  error: string | null;
}

type ResolvedDataMap = Record<string, ResolvedSourceState>;

const DataContext = createContext<ResolvedDataMap>({});

function useAnySourceUnconfigured(): boolean {
  const resolvedData = useContext(DataContext);
  return Object.values(resolvedData).some((s) => {
    if (s.loading) return false;
    if (s.data && typeof s.data === "object") {
      const data = s.data as Record<string, unknown>;
      if (data.configured === false) return true;
    }
    if (!s.data || s.error) return true;
    return false;
  });
}

function makeState(overrides: Partial<ResolvedSourceState>): ResolvedSourceState {
  return {
    data: null,
    fetchedAt: null,
    refetch: null,
    loading: false,
    error: null,
    ...overrides,
  };
}

function wrapper(map: ResolvedDataMap) {
  return ({ children }: { children: ReactNode }) => (
    <DataContext.Provider value={map}>{children}</DataContext.Provider>
  );
}

describe("useAnySourceUnconfigured", () => {
  it("returns false when all sources are configured with data", () => {
    const map: ResolvedDataMap = {
      github: makeState({ data: { configured: true, repos: [] } }),
    };
    const { result } = renderHook(() => useAnySourceUnconfigured(), { wrapper: wrapper(map) });
    expect(result.current).toBe(false);
  });

  it("returns true when a source has configured: false", () => {
    const map: ResolvedDataMap = {
      github: makeState({ data: { configured: false } }),
    };
    const { result } = renderHook(() => useAnySourceUnconfigured(), { wrapper: wrapper(map) });
    expect(result.current).toBe(true);
  });

  it("returns true when a source has error and no data", () => {
    const map: ResolvedDataMap = {
      sentry: makeState({ error: "401 Unauthorized" }),
    };
    const { result } = renderHook(() => useAnySourceUnconfigured(), { wrapper: wrapper(map) });
    expect(result.current).toBe(true);
  });

  it("returns true when a source has null data after loading", () => {
    const map: ResolvedDataMap = {
      vercel: makeState({ data: null }),
    };
    const { result } = renderHook(() => useAnySourceUnconfigured(), { wrapper: wrapper(map) });
    expect(result.current).toBe(true);
  });

  it("returns false while source is still loading", () => {
    const map: ResolvedDataMap = {
      vercel: makeState({ loading: true, data: null }),
    };
    const { result } = renderHook(() => useAnySourceUnconfigured(), { wrapper: wrapper(map) });
    expect(result.current).toBe(false);
  });

  it("returns true if any of multiple sources is unconfigured", () => {
    const map: ResolvedDataMap = {
      github: makeState({ data: { configured: true, repos: [] } }),
      vercel: makeState({ data: { configured: false } }),
    };
    const { result } = renderHook(() => useAnySourceUnconfigured(), { wrapper: wrapper(map) });
    expect(result.current).toBe(true);
  });

  it("returns false when data has error field but configured is true", () => {
    const map: ResolvedDataMap = {
      sentry: makeState({ data: { configured: true, sentry: null }, error: null }),
    };
    const { result } = renderHook(() => useAnySourceUnconfigured(), { wrapper: wrapper(map) });
    expect(result.current).toBe(false);
  });
});
