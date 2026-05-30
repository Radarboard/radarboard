// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { VercelDeploymentsModule } from "..";

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

vi.mock("../hooks/use-deployments", () => ({
  useVercelDeployments: (...args: unknown[]) => mockUseVercelDeployments(...args),
}));

vi.mock("../hooks/use-domains", () => ({
  useVercelDomains: (...args: unknown[]) => mockUseVercelDomains(...args),
}));

const PROJECTS: Project[] = [
  {
    id: "1",
    name: "Goshuin Atlas",
    slug: "goshuin-atlas",
    color: "#ff4f6d",
    platforms: [],
  },
];

const FIXTURE = [
  {
    id: "dep_1",
    url: "app.vercel.app",
    inspectorUrl: "https://vercel.com/dep-1",
    state: "READY",
    readyState: "READY",
    target: "production",
    created: Date.now() - 60_000,
    buildingAt: Date.now() - 120_000,
    ready: Date.now() - 60_000,
    buildDuration: 60_000,
    commitMessage: "Fix deployment config",
    commitSha: "abc",
    commitAuthor: "david",
    branch: "main",
    projectId: "1",
    projectName: "Goshuin Atlas",
    projectColor: "#ff4f6d",
    creatorUsername: "david",
  },
  {
    id: "dep_2",
    url: "app.vercel.app",
    inspectorUrl: "https://vercel.com/dep-2",
    state: "ERROR",
    readyState: "ERROR",
    target: "production",
    created: Date.now() - 86_400_000,
    buildingAt: Date.now() - 86_460_000,
    ready: Date.now() - 86_430_000,
    buildDuration: 30_000,
    commitMessage: "Broken deploy",
    commitSha: "def",
    commitAuthor: "david",
    branch: "main",
    projectId: "1",
    projectName: "Goshuin Atlas",
    projectColor: "#ff4f6d",
    creatorUsername: "david",
  },
];

describe("VercelDeploymentsModule", () => {
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
      deployments: FIXTURE,
      projects: [],
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
      loading: false,
      error: null,
    });
    window.open = vi.fn();
  });

  it("renders compact chart, shared KPI strip, and linked rows", async () => {
    render(
      createElement(VercelDeploymentsModule, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect(await screen.findByText("Deploys")).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("Fix deployment config")).toBeTruthy();
    expect(screen.getAllByText("goshuin-atlas").length).toBeGreaterThan(0);

    const bars = document.querySelectorAll('[title*="ok"]');
    expect(bars.length).toBe(7);

    const row = screen.getByRole("link", { name: /Fix deployment config/i });
    expect(row.getAttribute("href")).toBe("https://vercel.com/dep-1");
  });

  it("normalizes inspector urls and falls back to a placeholder commit message", async () => {
    mockUseVercelDeployments.mockReturnValue({
      deployments: [
        {
          ...FIXTURE[0],
          inspectorUrl: "vercel.com/dep-3",
          commitMessage: null,
        },
      ],
      projects: [],
      fetchedAt: 1_700_000_000,
      refetch: vi.fn(async () => {}),
      loading: false,
      error: null,
    });

    render(
      createElement(VercelDeploymentsModule, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    const row = await screen.findByRole("link", { name: /No commit message/i });
    expect(row.getAttribute("href")).toBe("https://vercel.com/dep-3");
  });
});
