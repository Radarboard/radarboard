// @vitest-environment jsdom

import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { Project } from "@radarboard/types/project";
import { TooltipProvider } from "@radarboard/ui/tooltip";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProjects } from "../index";

const {
  queryState,
  setProjectDialogParamMock,
  setSelectedSlugMock,
  updateProjectLayoutMock,
  updateIntegrationsMock,
  updateIntegrationMock,
} = vi.hoisted(() => ({
  queryState: {
    project: "__all__",
    projectDialog: null as string | null,
    integrationIntent: null as string | null,
  },
  setProjectDialogParamMock: vi.fn(),
  setSelectedSlugMock: vi.fn(),
  updateProjectLayoutMock: vi.fn(),
  updateIntegrationsMock: vi.fn(),
  updateIntegrationMock: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {},
  useQueryState: (key: "project" | "projectDialog" | "integrationIntent") => [
    queryState[key] ?? null,
    key === "projectDialog" ? setProjectDialogParamMock : setSelectedSlugMock,
  ],
}));

vi.mock("@radarboard/hooks/use-demo-mode", () => ({
  useDemoMode: () => ({
    isDemoMode: false,
  }),
}));

vi.mock("@radarboard/hooks/use-dashboard", () => ({
  useDashboard: () => ({
    projectLayouts: {
      [ALL_PROJECTS_SLUG]: {
        pages: [
          {
            name: "Overview",
            slug: "overview",
            layoutId: "basic",
            widgetLayouts: {
              basic: {
                "cell-1": "analytics",
                "cell-2": "aggregate-only",
                "cell-3": "sponsorship",
              },
            },
          },
        ],
      },
    },
    updateProjectLayout: updateProjectLayoutMock,
  }),
}));

vi.mock("@/hooks/projects/use-project-integrations", () => ({
  useProjectIntegrations: () => ({
    integrations: {},
    getIntegration: () => null,
    updateIntegrations: updateIntegrationsMock,
    updateIntegration: updateIntegrationMock,
  }),
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  WIDGET_REGISTRY: new Map([
    ["analytics", { id: "analytics", supportedDashboardScopes: undefined }],
    ["aggregate-only", { id: "aggregate-only", supportedDashboardScopes: ["all-projects"] }],
    ["sponsorship", { id: "sponsorship", supportedDashboardScopes: ["project"] }],
  ]),
}));

vi.mock("../project-detail-panel", () => ({
  AllProjectPanel: () => <div>All Projects panel</div>,
  DeleteProjectDialog: () => null,
  ProjectDetailPanel: ({
    project,
    projectSetupIntent,
  }: {
    project: Project;
    projectSetupIntent?: string | null;
  }) => (
    <div>
      Project detail: {project.name} {projectSetupIntent}
    </div>
  ),
}));

const PROJECTS: Project[] = [
  {
    id: "radarboard",
    slug: "radarboard",
    name: "Radarboard",
    color: "#5b8af5",
    description: "",
    platforms: [],
  },
];

function renderSettingsProjects(overrides?: { onOrderChange?: (newOrder: string[]) => void }) {
  return render(
    <TooltipProvider>
      <SettingsProjects
        projects={PROJECTS}
        projectOrder={PROJECTS.map((project) => project.slug)}
        onOrderChange={overrides?.onOrderChange ?? vi.fn()}
      />
    </TooltipProvider>
  );
}

describe("SettingsProjects", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    queryState.project = ALL_PROJECTS_SLUG;
    queryState.projectDialog = null;
    queryState.integrationIntent = null;
    setProjectDialogParamMock.mockClear();
    setSelectedSlugMock.mockClear();
    updateProjectLayoutMock.mockClear();
    updateIntegrationsMock.mockClear();
    updateIntegrationMock.mockClear();
  });

  it("opens the new project form from projectDialog=new", () => {
    queryState.projectDialog = "new";

    renderSettingsProjects();

    expect(screen.getByPlaceholderText(/project name/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("shows a sponsorship setup chooser without selecting All Projects", () => {
    queryState.project = null;
    queryState.integrationIntent = "sponsorship-project";

    renderSettingsProjects();

    expect(screen.getByText("Choose a project to finish Sponsorship setup")).toBeTruthy();
    expect(screen.getByText("Select a project")).toBeTruthy();
    expect(screen.getByText("Open or add a platform")).toBeTruthy();
    expect(screen.getByText("Add Open Collective slug or GitHub repo")).toBeTruthy();
    expect(screen.queryByText("All Projects")).toBeTruthy();
    expect(setSelectedSlugMock).not.toHaveBeenCalledWith(ALL_PROJECTS_SLUG);
  });

  it("opens project creation from a project setup intent", async () => {
    queryState.project = null;
    queryState.integrationIntent = "sentry-project";

    renderSettingsProjects();

    expect(screen.getByText("Create or select a project to link Sentry")).toBeTruthy();
    expect(screen.getByText(/All Projects uses Sentry's organization-wide data/i)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(setProjectDialogParamMock).toHaveBeenCalledWith("new");
  });

  it("keeps All Projects accessible while a project setup intent is active", async () => {
    queryState.project = null;
    queryState.integrationIntent = "sentry-project";

    renderSettingsProjects();

    const allProjectsButton = screen.getByRole("option", { name: /All Projects/i });
    expect(allProjectsButton.hasAttribute("disabled")).toBe(false);

    await userEvent.click(allProjectsButton);

    expect(setSelectedSlugMock).toHaveBeenCalledWith(ALL_PROJECTS_SLUG);
  });

  it("keeps normal Projects settings on All Projects when no setup intent is present", async () => {
    queryState.project = null;

    renderSettingsProjects();

    await waitFor(() => {
      expect(setSelectedSlugMock).toHaveBeenCalledWith(ALL_PROJECTS_SLUG);
    });
  });

  it("clears the create intent when cancelling a new project", async () => {
    queryState.projectDialog = "new";

    renderSettingsProjects();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(setProjectDialogParamMock).toHaveBeenCalledWith(null);
  });

  it("creates a project and clears the create intent", async () => {
    const user = userEvent.setup();
    const onOrderChange = vi.fn();
    queryState.projectDialog = "new";

    renderSettingsProjects({ onOrderChange });

    await user.type(screen.getByPlaceholderText(/project name/i), "Launch Monitor");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(updateIntegrationsMock).toHaveBeenCalledOnce();
    expect(updateIntegrationsMock.mock.calls[0]?.[0]({})).toEqual({
      "@@projects": {
        _: {
          ids: ["launch-monitor"],
        },
      },
      "@@proj_launch-monitor": {
        _: {
          color: expect.any(String),
          name: "Launch Monitor",
        },
      },
    });
    expect(onOrderChange).toHaveBeenCalledWith(["radarboard", "launch-monitor"]);
    expect(updateProjectLayoutMock).toHaveBeenCalledWith("launch-monitor", {
      pages: [
        {
          name: "Overview",
          slug: "overview",
          layoutId: "basic",
          widgetLayouts: {
            basic: {
              "cell-1": "analytics",
              "cell-2": null,
              "cell-3": "sponsorship",
            },
          },
        },
      ],
    });
    expect(setProjectDialogParamMock).toHaveBeenCalledWith(null);
    expect(setSelectedSlugMock).toHaveBeenCalledWith("launch-monitor");
  });
});
