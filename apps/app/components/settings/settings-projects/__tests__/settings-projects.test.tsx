// @vitest-environment jsdom

import type { Project } from "@radarboard/types/project";
import { TooltipProvider } from "@radarboard/ui/tooltip";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProjects } from "../index";

const {
  queryState,
  setProjectDialogParamMock,
  setSelectedSlugMock,
  updateIntegrationMock,
} = vi.hoisted(() => ({
  queryState: {
    project: "all",
    projectDialog: null as string | null,
  },
  setProjectDialogParamMock: vi.fn(),
  setSelectedSlugMock: vi.fn(),
  updateIntegrationMock: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {},
  useQueryState: (key: "project" | "projectDialog") => [
    queryState[key] ?? null,
    key === "projectDialog" ? setProjectDialogParamMock : setSelectedSlugMock,
  ],
}));

vi.mock("@radarboard/hooks/use-demo-mode", () => ({
  useDemoMode: () => ({
    isDemoMode: false,
  }),
}));

vi.mock("@/hooks/projects/use-project-integrations", () => ({
  useProjectIntegrations: () => ({
    integrations: {},
    getIntegration: () => null,
    updateIntegration: updateIntegrationMock,
  }),
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
    queryState.project = "all";
    queryState.projectDialog = null;
    setProjectDialogParamMock.mockClear();
    setSelectedSlugMock.mockClear();
    updateIntegrationMock.mockClear();
  });

  it("opens the new project form from projectDialog=new", () => {
    queryState.projectDialog = "new";

    renderSettingsProjects();

    expect(screen.getByPlaceholderText(/project name/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
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

    expect(updateIntegrationMock).toHaveBeenCalledWith("@@projects", "_", "ids", [
      "launch-monitor",
    ]);
    expect(updateIntegrationMock).toHaveBeenCalledWith(
      "@@proj_launch-monitor",
      "_",
      "name",
      "Launch Monitor"
    );
    expect(onOrderChange).toHaveBeenCalledWith(["radarboard", "launch-monitor"]);
    expect(setProjectDialogParamMock).toHaveBeenCalledWith(null);
    expect(setSelectedSlugMock).toHaveBeenCalledWith("launch-monitor");
  });
});
