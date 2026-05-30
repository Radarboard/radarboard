// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../../deployments/src/data-resolver";
import { domainsDescriptor } from "..";

const mockUseDashboard = vi.fn();
const mockUseVercelDomains = vi.fn();
const mockUseVercelDeployments = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => mockUseDashboard(),
  };
});

vi.mock("../hooks/use-domains", () => ({
  useVercelDomains: (...args: unknown[]) => mockUseVercelDomains(...args),
  useVercelDeployments: (...args: unknown[]) => mockUseVercelDeployments(...args),
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

describe("domainsDescriptor", () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({ projects: PROJECTS });
    mockUseVercelDeployments.mockReturnValue({
      deployments: [],
      projects: [],
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
      loading: false,
      error: null,
    });
    mockUseVercelDomains.mockReturnValue({
      domains: [
        {
          name: "goshuin.app",
          verified: true,
          configured: true,
          projectId: "1",
          projectName: "Goshuin Atlas",
          projectColor: "#ff4f6d",
        },
      ],
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
      loading: false,
      error: null,
    });
  });

  it("renders compact KPI cells and shared inline rows", async () => {
    render(
      createElement(domainsDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect(await screen.findByText("Total Domains")).toBeTruthy();
    expect(screen.getByText("Domain")).toBeTruthy();
    expect(screen.getByText("Project")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("goshuin.app")).toBeTruthy();
    expect(screen.getByText("goshuin-atlas")).toBeTruthy();
  });
});
