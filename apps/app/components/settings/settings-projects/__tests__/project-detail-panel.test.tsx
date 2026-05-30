// @vitest-environment jsdom

import type { Platform, Project } from "@radarboard/types/project";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectOpenPanelProjectIds,
  PlatformSection,
  ProjectDetailPanel,
} from "../project-detail-panel";

const {
  connectedKeysState,
  serviceEntries,
  integrationState,
  openPanelProjectsState,
  serviceConfiguredState,
  updateIntegrationMock,
  useDashboardMock,
  useProjectContextMock,
} = vi.hoisted(() => ({
  connectedKeysState: [] as string[],
  serviceEntries: [
    {
      auth: { name: "GitHub" },
      credKey: "github",
      description: "GitHub repos and activity.",
      integrationKey: "github",
      pollingSourceIds: [],
      usedByWidgets: [],
    },
    {
      auth: { name: "OpenPanel" },
      credKey: "openpanel",
      description: "Web analytics and growth metrics.",
      integrationKey: "openPanel",
      pollingSourceIds: [],
      usedByWidgets: [],
    },
  ],
  integrationState: {} as Record<string, unknown>,
  openPanelProjectsState: {
    configured: false,
    projects: [] as Array<{ id: string; name: string | null }>,
  },
  serviceConfiguredState: {
    github: true,
    openpanel: false,
  } as Record<string, boolean>,
  updateIntegrationMock: vi.fn(),
  useDashboardMock: vi.fn(),
  useProjectContextMock: vi.fn(),
}));

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: useDashboardMock,
  };
});

vi.mock("@radarboard/hooks/use-credentials", () => ({
  useCredentials: () => ({
    connectedKeys: connectedKeysState,
  }),
}));

vi.mock("@radarboard/hooks/use-mcp-servers", () => ({
  useMcpServers: () => ({
    servers: [],
  }),
}));

vi.mock("@/hooks/settings/use-integration-connections", () => ({
  useIntegrationConnections: () => ({
    connections: [],
  }),
}));

vi.mock("@/hooks/projects/use-project-context", () => ({
  useProjectContext: useProjectContextMock,
}));

vi.mock("@radarboard/hooks/use-sentry-projects", () => ({
  useSentryProjects: () => ({
    slugs: [],
  }),
}));

vi.mock("swr", () => ({
  default: (key: string) => {
    if (typeof key === "string" && key.includes("/api/integrations/openpanel/projects")) {
      return { data: openPanelProjectsState };
    }
    return { data: undefined };
  },
}));

vi.mock("@/components/shared/remote-service-icon", () => ({
  RemoteServiceIcon: ({ alt }: { alt?: string }) => <span>{alt ?? "icon"}</span>,
}));

vi.mock("@/components/settings/settings-catalog-card", () => ({
  SettingsCatalogCard: ({
    title,
    status,
    onOpen,
    openAriaLabel,
  }: {
    title: ReactNode;
    status?: ReactNode;
    onOpen?: () => void;
    openAriaLabel?: string;
  }) => (
    <button type="button" onClick={onOpen} aria-label={openAriaLabel}>
      <span>{title}</span>
      <span>{status}</span>
    </button>
  ),
}));

vi.mock("@radarboard/ui/app-dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogBody: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogCancelButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ConfirmationDialog: () => null,
}));

vi.mock("../../projects/repo-picker", () => ({
  RepoPicker: () => <div>Repo picker</div>,
}));

vi.mock("../../settings-integrations/utils", () => ({
  collectServices: () => [...serviceEntries],
  getServiceApiConfigured: (service: { credKey: string }) =>
    Boolean(serviceConfiguredState[service.credKey]),
  getServiceConnectionCount: () => 0,
  getServiceMcpReady: () => false,
}));

vi.mock("../../project-settings-tabs", () => ({
  ProjectSettingsTabs: ({ platformsContent }: { platformsContent: ReactNode }) => (
    <div>{platformsContent}</div>
  ),
}));

function createProject(): Project {
  return {
    id: "project-1",
    slug: "goshuin-atlas",
    name: "Goshuin Atlas",
    color: "#000000",
    description: "",
    platforms: [],
  };
}

function renderPlatformSection(
  platform: Platform,
  overrides?: { onOpenIntegrationSettings?: (serviceId: string) => void }
) {
  const project = createProject();
  const getIntegration = (projectSlug: string, platformId: string, key: string) =>
    integrationState[`${projectSlug}:${platformId}:${key}`] ?? null;
  const updateIntegration = (
    projectSlug: string,
    platformId: string,
    key: string,
    value: unknown
  ) => {
    integrationState[`${projectSlug}:${platformId}:${key}`] = value;
    updateIntegrationMock(projectSlug, platformId, key, value);
  };

  return render(
    <PlatformSection
      platform={platform}
      projectSlug={project.slug}
      allProjects={[project]}
      isUserPlatform={false}
      onDeletePlatform={undefined}
      onOpenIntegrationSettings={overrides?.onOpenIntegrationSettings}
      getIntegration={getIntegration}
      updateIntegration={updateIntegration}
    />
  );
}

function renderProjectDetailPanel(overrides?: {
  project?: Project;
  allProjects?: Project[];
  getIntegration?: (projectSlug: string, platformId: string, key: string) => unknown;
}) {
  const project = overrides?.project ?? createProject();
  const getIntegration =
    overrides?.getIntegration ??
    ((projectSlug: string, platformId: string, key: string) =>
      integrationState[`${projectSlug}:${platformId}:${key}`] ?? null);
  const updateIntegration = (
    projectSlug: string,
    platformId: string,
    key: string,
    value: unknown
  ) => {
    integrationState[`${projectSlug}:${platformId}:${key}`] = value;
    updateIntegrationMock(projectSlug, platformId, key, value);
  };

  return render(
    <ProjectDetailPanel
      project={project}
      allProjects={overrides?.allProjects ?? [project]}
      integrations={{}}
      isUserCreated
      onDeleteProject={vi.fn()}
      getIntegration={getIntegration}
      updateIntegration={updateIntegration}
    />
  );
}

describe("PlatformSection", () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => undefined;
    Element.prototype.releasePointerCapture ??= () => undefined;
    useDashboardMock.mockReturnValue({
      projectLayouts: {},
    });
    useProjectContextMock.mockReturnValue({
      getContext: vi.fn(),
      updateContext: vi.fn(),
    });
    connectedKeysState.splice(0, connectedKeysState.length, "github");
    serviceConfiguredState.github = true;
    serviceConfiguredState.openpanel = false;
    updateIntegrationMock.mockReset();
    openPanelProjectsState.configured = false;
    openPanelProjectsState.projects = [];
    for (const key of Object.keys(integrationState)) {
      delete integrationState[key];
    }
  });

  it("shows only the empty configured-state message when no integrations are attached", () => {
    renderPlatformSection({
      id: "website",
      name: "Website",
      type: "website",
      integrations: {},
    });

    expect(screen.getByText("No integrations configured for this platform.")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Disable GitHub" })).toBeNull();
    expect(screen.queryByText("GitHub repos and activity.")).toBeNull();
  });

  it("lists compatible services with configured state in the add-integration dialog", async () => {
    const user = userEvent.setup();

    renderPlatformSection({
      id: "website",
      name: "Website",
      type: "website",
      integrations: {},
    });

    await user.click(screen.getByRole("button", { name: /add integration/i }));

    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("Configured")).toBeTruthy();
    expect(screen.getByText("OpenPanel")).toBeTruthy();
    expect(screen.getByText("Not configured")).toBeTruthy();
  });

  it("attaches configured integrations directly from the picker", async () => {
    const user = userEvent.setup();

    renderPlatformSection({
      id: "website",
      name: "Website",
      type: "website",
      integrations: {},
    });

    await user.click(screen.getByRole("button", { name: /add integration/i }));
    await user.click(screen.getByRole("button", { name: "Attach GitHub to Website" }));

    expect(screen.getByRole("switch", { name: "Disable GitHub" })).toBeTruthy();
  });

  it("opens integration settings instead of attaching unconfigured services", async () => {
    const user = userEvent.setup();
    const onOpenIntegrationSettings = vi.fn();

    renderPlatformSection(
      {
        id: "website",
        name: "Website",
        type: "website",
        integrations: {},
      },
      { onOpenIntegrationSettings }
    );

    await user.click(screen.getByRole("button", { name: /add integration/i }));
    await user.click(screen.getByRole("button", { name: "Open OpenPanel setup" }));

    expect(onOpenIntegrationSettings).toHaveBeenCalledWith("openpanel");
    expect(screen.queryByRole("switch", { name: "Disable OpenPanel" })).toBeNull();
  });

  it("restores hidden base integrations from the add flow", async () => {
    const user = userEvent.setup();

    integrationState["goshuin-atlas:website:github._hidden"] = true;

    renderPlatformSection({
      id: "website",
      name: "Website",
      type: "website",
      integrations: {
        github: {
          owner: "radarboard",
          repo: "radarboard",
        },
      },
    });

    expect(screen.queryByRole("switch", { name: "Disable GitHub" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /add integration/i }));
    await user.click(screen.getByRole("button", { name: "Attach GitHub to Website" }));

    expect(updateIntegrationMock).toHaveBeenCalledWith(
      "goshuin-atlas",
      "website",
      "github._hidden",
      false
    );
    expect(screen.getByRole("switch", { name: "Disable GitHub" })).toBeTruthy();
  });

  it("collects OpenPanel project ids from overrides and user-added platforms", () => {
    integrationState["goshuin-atlas:website:openPanel.projectId"] = "override-project";
    integrationState["another-project:@@platforms:ids"] = ["custom-platform"];
    integrationState["another-project:custom-platform:openPanel.projectId"] = "custom-project";

    const allProjects: Project[] = [
      {
        ...createProject(),
        platforms: [
          {
            id: "website",
            name: "Website",
            type: "website",
            integrations: {
              openPanel: {
                projectId: "base-project",
              },
            },
          },
        ],
      },
      {
        id: "project-2",
        slug: "another-project",
        name: "Another Project",
        color: "#111111",
        description: "",
        platforms: [],
      },
    ];

    const getIntegration = (projectSlug: string, platformId: string, key: string) =>
      integrationState[`${projectSlug}:${platformId}:${key}`] ?? null;

    expect(collectOpenPanelProjectIds(allProjects, getIntegration)).toEqual([
      "custom-project",
      "override-project",
    ]);
  });

  it("uses fetched OpenPanel projects in the selector label when the current value matches a fetched project", () => {
    openPanelProjectsState.configured = true;
    openPanelProjectsState.projects = [
      { id: "op_1", name: "Atlas Analytics" },
      { id: "op_2", name: "Growth Dashboard" },
    ];
    integrationState["goshuin-atlas:website:openPanel.projectId"] = "op_1";

    renderPlatformSection({
      id: "website",
      name: "Website",
      type: "website",
      integrations: {
        openPanel: {},
      },
    });

    expect(screen.getByRole("combobox").textContent).toContain("Atlas Analytics — op_1");
  });

  it("preserves the current OpenPanel project id when it is not returned by the fetched list", async () => {
    openPanelProjectsState.configured = true;
    openPanelProjectsState.projects = [{ id: "op_1", name: "Atlas Analytics" }];
    integrationState["goshuin-atlas:website:openPanel.projectId"] = "legacy-project";

    renderPlatformSection({
      id: "website",
      name: "Website",
      type: "website",
      integrations: {
        openPanel: {},
      },
    });

    expect(screen.getByRole("combobox").textContent).toContain("legacy-project");
  });
});

describe("ProjectDetailPanel", () => {
  it("prefills the new platform name from the current project name and selects it on open", async () => {
    const user = userEvent.setup();
    renderProjectDetailPanel();

    await user.click(screen.getByRole("button", { name: /add platform/i }));

    const input = screen.getByPlaceholderText("Platform name…") as HTMLInputElement;
    const form = input.closest("form");
    if (!form) throw new Error("Expected platform form to render");
    const addButton = within(form).getByRole("button", { name: "Add Platform" });

    expect((form as HTMLFormElement).className).toContain("max-w-3xl");
    expect(input.value).toBe("Goshuin Atlas");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Goshuin Atlas".length);
    expect((addButton as HTMLButtonElement).disabled).toBe(false);

    await user.keyboard("Website");

    expect(input.value).toBe("Website");
    expect((addButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps the new platform name empty when the current project name is blank", async () => {
    const user = userEvent.setup();

    renderProjectDetailPanel({
      getIntegration: (_projectSlug, platformId, key) => {
        if (platformId === "_project" && key === "name") return "";
        return null;
      },
    });

    await user.click(screen.getByRole("button", { name: /add platform/i }));

    const input = screen.getByPlaceholderText("Platform name…") as HTMLInputElement;
    const form = input.closest("form");
    if (!form) throw new Error("Expected platform form to render");
    const addButton = within(form).getByRole("button", { name: "Add Platform" });

    expect((form as HTMLFormElement).className).toContain("max-w-3xl");
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
  });
});
