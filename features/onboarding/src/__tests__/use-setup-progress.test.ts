// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSetupProgress } from "../hooks/use-setup-progress";

vi.mock("@radarboard/hooks/use-dashboard", () => ({
  useDashboard: vi.fn(() => ({
    preferences: { intendedIntegrations: ["github", "vercel", "stripe", "sentry", "openpanel"] },
  })),
}));

vi.mock("@radarboard/hooks/use-credentials", () => ({
  useCredentials: vi.fn(() => ({
    connectedKeys: ["github", "vercel", "stripe"],
  })),
}));

afterEach(() => vi.restoreAllMocks());

describe("useSetupProgress", () => {
  it("returns configured count and label", () => {
    const { result } = renderHook(() => useSetupProgress());

    expect(result.current.intended).toBe(5);
    expect(result.current.configured).toBe(3);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.label).toBe("3/5");
  });

  it("returns isComplete when all configured", async () => {
    const { useCredentials } = await import("@radarboard/hooks/use-credentials");
    (useCredentials as ReturnType<typeof vi.fn>).mockReturnValue({
      connectedKeys: ["github", "vercel", "stripe", "sentry", "openpanel"],
    });

    const { result } = renderHook(() => useSetupProgress());
    expect(result.current.isComplete).toBe(true);
    expect(result.current.label).toBeNull();
  });

  it("returns complete with no intended integrations", async () => {
    const { useDashboard } = await import("@radarboard/hooks/use-dashboard");
    (useDashboard as ReturnType<typeof vi.fn>).mockReturnValue({
      preferences: { intendedIntegrations: undefined },
    });

    const { result } = renderHook(() => useSetupProgress());
    expect(result.current.intended).toBe(0);
    expect(result.current.isComplete).toBe(true);
    expect(result.current.label).toBeNull();
  });
});
