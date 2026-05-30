// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../../deployments/src/data-resolver";
import { projectsDescriptor } from "..";

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

vi.mock("../hooks/use-projects", () => ({
  useVercelDeployments: (...args: unknown[]) => mockUseVercelDeployments(...args),
  useVercelDomains: (...args: unknown[]) => mockUseVercelDomains(...args),
}));

vi.mock("../../deployments/hooks/use-deployments", () => ({
  useVercelDeployments: (...args: unknown[]) => mockUseVercelDeployments(...args),
}));

vi.mock("../../deployments/hooks/use-domains", () => ({
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

describe("projectsDescriptor", () => {
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
      projects: [
        {
          id: "1",
          name: "Goshuin Atlas",
          framework: "nextjs",
          latestProductionState: "READY",
          latestProductionUrl: "https://goshuin.app",
          latestProductionReady: Date.now() - 60_000,
          primaryDomain: "goshuin.app",
          projectColor: "#ff4f6d",
        },
      ],
      deployments: [],
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
      loading: false,
      error: null,
    });
  });

  it("renders compact projects with the shared two-line row treatment", async () => {
    render(
      createElement(projectsDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect(await screen.findByText("Goshuin Atlas")).toBeTruthy();
    expect(screen.getByText("Next.js")).toBeTruthy();
  });
});
