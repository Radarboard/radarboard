// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { observabilityDescriptor } from "..";

const mockUseDashboard = vi.fn();
const mockUseSentry = vi.fn();
const mockUseAppStore = vi.fn();
const mockUseHealth = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => mockUseDashboard(),
  };
});

vi.mock("../hooks/use-sentry", () => ({
  useSentry: (...args: unknown[]) => mockUseSentry(...args),
}));

vi.mock("../hooks/use-app-store", () => ({
  useAppStore: (...args: unknown[]) => mockUseAppStore(...args),
}));

vi.mock("../hooks/use-health", () => ({
  useHealth: () => mockUseHealth(),
}));

const PROJECTS: Project[] = [
  {
    id: "1",
    name: "Goshuin Atlas",
    slug: "goshuin-atlas",
    color: "#ff4f6d",
    platforms: [
      {
        id: "ios",
        name: "iOS",
        type: "ios",
        integrations: {
          sentry: { projectSlug: "goshuin-atlas-ios" },
        },
      },
    ],
  },
];

describe("observabilityDescriptor sentry mode", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    mockUseDashboard.mockReturnValue({ projects: PROJECTS });
    mockUseSentry.mockReturnValue({
      data: {
        unresolvedCount: 59,
        errorTrend: [
          { date: "2026-03-17", value: 2 },
          { date: "2026-03-18", value: 4 },
        ],
        issues: [
          {
            id: "issue_1",
            shortId: "AUTH-1",
            title: "OAuth callback failed",
            culprit: "app/api/auth/oauth/route.ts",
            level: "error",
            count: 12,
            userCount: 3,
            firstSeen: new Date(Date.now() - 86_400_000).toISOString(),
            lastSeen: new Date(Date.now() - 3_600_000).toISOString(),
            projectName: "Goshuin Atlas",
            projectSlug: "goshuin-atlas-ios",
            projectColor: "#ff4f6d",
            permalink: "https://sentry.io/issues/issue_1",
            isUnhandled: true,
          },
        ],
      },
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
    mockUseAppStore.mockReturnValue({
      data: null,
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
    mockUseHealth.mockReturnValue({
      checks: [],
      incidents: [],
      configured: true,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("renders sentry mode through the template rail recipe", { timeout: 15_000 }, async () => {
    render(
      createElement(observabilityDescriptor.component, { projectSlug: "goshuin-atlas", config: {} })
    );

    expect(await screen.findByText("issues")).toBeTruthy();
    expect(screen.getByText("OAuth callback failed")).toBeTruthy();
    expect(screen.getByText("goshuin-atlas-ios")).toBeTruthy();
    expect(screen.getByText("app/api/auth/oauth/route.ts")).toBeTruthy();
  });
});
