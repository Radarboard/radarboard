// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsIntegrations } from "../index";

const { querySetters, queryState } = vi.hoisted(() => ({
  queryState: {
    integrationCategory: null as string | null,
    integrationIntent: null as string | null,
    integrationTab: null as string | null,
    service: null as string | null,
    settingsInstaller: null as string | null,
  },
  querySetters: new Map<string, ReturnType<typeof vi.fn>>(),
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

vi.mock("@/hooks/settings/use-user-integrations", () => ({
  useUserIntegrations: () => ({
    integrations: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock("../components/access/detail-modal", () => ({
  ServiceDetailModal: () => null,
}));

vi.mock("../components/access/service-card", () => ({
  ServiceCard: ({ service }: { service: { auth: { name?: string }; credKey: string } }) => (
    <div data-testid="service-card">{service.auth.name ?? service.credKey}</div>
  ),
}));

vi.mock("../../community-discovery", () => ({
  CommunityExtensionDiscovery: () => null,
}));

vi.mock("../../extension-installer", () => ({
  InstallExtensionDialog: () => null,
}));

vi.mock("../../settings-category-tabs", () => ({
  SettingsCategoryTabs: () => null,
}));

vi.mock("../../settings-page-layout", () => ({
  SettingsCardSection: ({ children, title }: { children: ReactNode; title?: string }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
  SettingsGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsPageLayout: ({ children, statusText }: { children: ReactNode; statusText?: string }) => (
    <main>
      {statusText ? <p data-testid="integration-status">{statusText}</p> : null}
      {children}
    </main>
  ),
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

describe("SettingsIntegrations registry catalog", () => {
  beforeEach(() => {
    queryState.integrationCategory = null;
    queryState.integrationIntent = null;
    queryState.integrationTab = null;
    queryState.service = null;
    queryState.settingsInstaller = null;
    querySetters.clear();
  });

  it("renders widget-declared integration services, not only runtime integration descriptors", () => {
    render(<SettingsIntegrations />);

    const cards = screen.getAllByTestId("service-card").map((card) => card.textContent);

    expect(cards.length).toBeGreaterThan(2);
    expect(cards).toEqual(expect.arrayContaining(["RevenueCat", "OpenPanel", "GitHub", "Sentry"]));
    expect(screen.getByTestId("integration-status").textContent).toContain(
      `${cards.length} providers`
    );
  });
});
