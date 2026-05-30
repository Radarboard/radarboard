// @vitest-environment jsdom
/**
 * Tests for useChatDrawer — the hook managing drawer open/close state via URL.
 * We test the URL-state logic in isolation, not the rendering.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// nuqs needs a router adapter — use the testing adapter
vi.mock("nuqs", () => {
  let value: string | null = null;

  return {
    parseAsString: { withDefault: (d: string) => ({ defaultValue: d }) },
    useQueryState: vi.fn((_key: string, _opts?: unknown) => {
      return [
        value,
        vi.fn((next: string | null) => {
          value = next;
        }),
      ];
    }),
  };
});

import { useChatDrawer } from "./use-chat-drawer";

describe("useChatDrawer", () => {
  it("starts closed by default", () => {
    const { result } = renderHook(() => useChatDrawer());
    expect(result.current.isOpen).toBe(false);
  });

  it("exposes open and close functions", () => {
    const { result } = renderHook(() => useChatDrawer());
    expect(result.current.open).toBeTypeOf("function");
    expect(result.current.close).toBeTypeOf("function");
    expect(result.current.toggle).toBeTypeOf("function");
  });
});
