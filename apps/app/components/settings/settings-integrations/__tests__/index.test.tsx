// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsIntegrations } from "../index";

const { querySetters, queryState, serviceEntries } = vi.hoisted(() => ({
  queryState: {
    integrationCategory: null as string | null,
    integrationIntent: null as string | null,
    integrationTab: null as string | null,
    service: null as string | null,
    settingsInstaller: null as string | null,
  },
  querySetters: new Map<string, ReturnType<typeof vi.fn>>(),
  serviceEntries: [
    {
      auth: { name: "GitHub" },
      credKey: "github",
      pollingSourceIds: [],
      usedByWidgets: [],
    },
    {
      auth: { name: "OpenPanel" },
      credKey: "openpanel",
      pollingSourceIds: [],
      usedByWidgets: [],
    },
    {
      auth: { name: "npm" },
      credKey: "npm",
      pollingSourceIds: [],
      usedByWidgets: [],
    },
    {
      auth: { name: "Umami" },
      credKey: "umami",
      pollingSourceIds: [],
      usedByWidgets: [],
    },
  ] as const,
}));

vi.mock("nuqs", () => ({
  parseAsString: {},
  useQueryState: vi.fn((key: string) => {
    const setter =
      querySetters.get(key) ??
      vi.fn((next: string | null) => {
        queryState[key] = next;
      });
    querySetters.set(key, setter);
    return [queryState[key] ?? null, setter];
  }),
}));

vi.mock("@radarboard/hooks/use-credentials", () => ({
  useCredentials: () => ({
    connectedKeys: [],
    refetch: vi.fn(),
  }),
}));

vi.mock("@radarboard/hooks/use-mcp-servers", () => ({
  useMcpServers: () => ({
    addOrUpdate: vi.fn(),
    servers: [],
    testConnection: vi.fn(),
  }),
}));

vi.mock("@/hooks/settings/use-integration-connections", () => ({
  useIntegrationConnections: () => ({
    addOrUpdate: vi.fn(),
    connections: [],
    providers: [],
    remove: vi.fn(),
  }),
}));

vi.mock("@/hooks/projects/use-project-integrations", () => ({
  useProjectIntegrations: () => ({
    getIntegration: vi.fn(() => null),
  }),
}));

vi.mock("../utils", () => ({
  collectServices: () => [...serviceEntries],
  getIntegrationCategories: () => [
    { id: "developer-tools", label: "Developer Tools", serviceIds: ["github", "npm"] },
    { id: "analytics", label: "Analytics & SEO", serviceIds: ["openpanel", "umami"] },
  ],
  getServiceApiConfigured: () => false,
  getServiceCapabilityIds: () => [],
  getServiceConnectionCount: () => 0,
  getServiceConnections: () => [],
  getServiceMcpReady: () => false,
}));

vi.mock("../components/access/detail-modal", () => ({
  ServiceDetailModal: ({ service, open }: { open: boolean; service: { credKey: string } }) =>
    open ? <div data-testid="service-detail-modal">{service.credKey}</div> : null,
}));

vi.mock("../components/access/service-card", () => ({
  ServiceCard: ({ service }: { service: { credKey: string } }) => <div>{service.credKey}</div>,
}));

vi.mock("../../extension-installer", () => ({
  InstallExtensionDialog: () => null,
}));

vi.mock("../../settings-category-tabs", () => ({
  SettingsCategoryTabs: () => null,
}));

vi.mock("../../settings-page-layout", () => ({
  SettingsCardSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPageToolbar: ({
    actions,
    navigation,
  }: {
    actions?: ReactNode;
    navigation?: ReactNode;
  }) => (
    <div>
      {navigation}
      {actions}
    </div>
  ),
}));

vi.mock("@radarboard/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@radarboard/ui/empty-state", () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
}));

describe("SettingsIntegrations", () => {
  beforeEach(() => {
    queryState.integrationCategory = null;
    queryState.integrationIntent = null;
    queryState.integrationTab = null;
    queryState.service = null;
    queryState.settingsInstaller = null;
    querySetters.clear();
  });

  it("opens the matching service modal from a valid service deep link", () => {
    queryState.service = "github";

    render(<SettingsIntegrations />);

    expect(screen.getByTestId("service-detail-modal").textContent).toBe("github");
  });

  it("accepts npm service deep links used by widget connect CTAs", () => {
    queryState.service = "npm";
    render(<SettingsIntegrations />);
    expect(screen.getByTestId("service-detail-modal").textContent).toBe("npm");
  });

  it("shows a filtered chooser for analytics intent deep links", () => {
    queryState.integrationIntent = "analytics";
    render(<SettingsIntegrations />);

    expect(screen.getByText("openpanel")).toBeTruthy();
    expect(screen.getByText("umami")).toBeTruthy();
    expect(screen.queryByText("github")).toBeNull();
    expect(screen.queryByTestId("service-detail-modal")).toBeNull();
  });

  it("can still open a service modal from the analytics chooser", () => {
    queryState.integrationIntent = "analytics";
    queryState.service = "openpanel";
    const { rerender } = render(<SettingsIntegrations />);
    expect(screen.getByTestId("service-detail-modal").textContent).toBe("openpanel");

    queryState.service = "npm";
    rerender(<SettingsIntegrations />);
    expect(screen.getByTestId("service-detail-modal").textContent).toBe("npm");
  });

  it("clears an invalid service deep link instead of opening a modal", async () => {
    queryState.integrationTab = "events";
    queryState.service = "unknown-service";

    render(<SettingsIntegrations />);

    await waitFor(() => {
      expect(querySetters.get("service")).toHaveBeenCalledWith(null);
      expect(querySetters.get("integrationTab")).toHaveBeenCalledWith(null);
    });

    expect(screen.queryByTestId("service-detail-modal")).toBeNull();
  });
});
