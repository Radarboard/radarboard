// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "./use-auto-save";

describe("useAutoSave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces saves and triggers before-first-save once", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => undefined);
    const onBeforeFirstSave = vi.fn();

    const { result } = renderHook(() => useAutoSave({ delay: 1000, onSave, onBeforeFirstSave }));

    act(() => {
      result.current.handleChange("alpha");
      result.current.handleChange("beta");
    });

    expect(result.current.status).toBe("idle");
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(onBeforeFirstSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("beta");
  });

  it("flushes immediately, reports errors, and resets state", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAutoSave({ onSave }));

    act(() => {
      result.current.handleChange("alpha");
    });

    await act(async () => {
      result.current.flush();
      await Promise.resolve();
    });

    expect(result.current.status).toBe("error");

    act(() => {
      result.current.handleChange("beta");
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
  });
});
