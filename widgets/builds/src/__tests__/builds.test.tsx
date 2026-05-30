// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../../deployments/src/data-resolver";
import { buildsDescriptor } from "..";

const mockUseDashboard = vi.fn();
const mockUseVercelDeployments = vi.fn();
const mockUseVercelDomains = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => mockUseDashboard(),
  };
});

vi.mock("../hooks/use-builds", () => ({
  useVercelDeployments: (...args: unknown[]) => mockUseVercelDeployments(...args),
  useVercelDomains: (...args: unknown[]) => mockUseVercelDomains(...args),
}));

vi.mock("../../../deployments/src/hooks/use-deployments", () => ({
  useVercelDeployments: (...args: unknown[]) => mockUseVercelDeployments(...args),
}));

vi.mock("../../../deployments/src/hooks/use-domains", () => ({
  useVercelDomains: (...args: unknown[]) => mockUseVercelDomains(...args),
}));

const PROJECTS: Project[] = [
  { id: "1", name: "Goshuin Atlas", slug: "goshuin-atlas", color: "#ff4f6d", platforms: [] },
];

describe("buildsDescriptor", () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({ projects: PROJECTS });
    mockUseVercelDomains.mockReturnValue({
      domains: [],
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
      loading: false,
      error: null,
    });
    mockUseVercelDeployments.mockReturnValue({
      deployments: [
        {
          id: "dep_1",
          url: "app.vercel.app",
          inspectorUrl: "https://vercel.com/dep-1",
          state: "READY",
          readyState: "READY",
          target: "production",
          created: Date.now() - 60_000,
          buildingAt: Date.now() - 180_000,
          ready: Date.now() - 60_000,
          buildDuration: 120_000,
          commitMessage: "Build perf refactor",
          commitSha: "abc",
          commitAuthor: "david",
          branch: "main",
          projectId: "1",
          projectName: "Goshuin Atlas",
          projectColor: "#ff4f6d",
          creatorUsername: "david",
        },
      ],
      projects: [],
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
      loading: false,
      error: null,
    });
  });

  it("renders compact KPI cells from shared primitives", async () => {
    render(
      createElement(buildsDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect(await screen.findByText("avg build time (s)")).toBeTruthy();
    expect(screen.getByText("Fastest")).toBeTruthy();
    expect(screen.getByText("Slowest")).toBeTruthy();
  });
});
