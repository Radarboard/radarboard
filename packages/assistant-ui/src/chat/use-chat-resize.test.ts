// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChatResize } from "./use-chat-resize";

describe("useChatResize", () => {
  it("starts with the default width", () => {
    const { result } = renderHook(() => useChatResize());
    expect(result.current.width).toBe(420);
  });

  it("clamps width to minimum", () => {
    const { result } = renderHook(() => useChatResize());
    act(() => {
      result.current.setWidth(100);
    });
    expect(result.current.width).toBe(280);
  });

  it("clamps width to maximum", () => {
    const { result } = renderHook(() => useChatResize());
    act(() => {
      result.current.setWidth(2000);
    });
    expect(result.current.width).toBe(800);
  });

  it("accepts widths within valid range", () => {
    const { result } = renderHook(() => useChatResize());
    act(() => {
      result.current.setWidth(500);
    });
    expect(result.current.width).toBe(500);
  });

  it("exposes drag handlers", () => {
    const { result } = renderHook(() => useChatResize());
    expect(result.current.handleDragStart).toBeTypeOf("function");
    expect(result.current.isDragging).toBe(false);
  });
});
