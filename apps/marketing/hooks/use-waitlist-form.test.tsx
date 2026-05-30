// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWaitlistForm } from "./use-waitlist-form";

function createSubmitEvent(): FormEvent {
  return {
    preventDefault: vi.fn(),
  } as unknown as FormEvent;
}

describe("useWaitlistForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("moves to success state after a successful submit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, message: "You're in!" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      )
    );

    const { result } = renderHook(() => useWaitlistForm());

    act(() => {
      result.current.setEmail("test@example.com");
    });

    await act(async () => {
      await result.current.submit(createSubmitEvent());
    });

    await waitFor(() => {
      expect(result.current.state).toBe("success");
    });
    expect(result.current.message).toBe("You're in!");
  });

  it("moves to error state on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const { result } = renderHook(() => useWaitlistForm());

    act(() => {
      result.current.setEmail("test@example.com");
    });

    await act(async () => {
      await result.current.submit(createSubmitEvent());
    });

    await waitFor(() => {
      expect(result.current.state).toBe("error");
    });
    expect(result.current.message).toBe("Network error. Please try again.");
  });
});
