// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceEntry } from "@/components/settings/settings-integrations/types";
import { ServiceDetailModal } from "../detail-modal";

const { queryState } = vi.hoisted(() => ({
  queryState: {
    integrationTab: null as string | null,
  },
}));

vi.mock("nuqs", () => ({
  parseAsStringLiteral: () => ({}),
  useQueryState: vi.fn(() => [
    queryState.integrationTab,
    vi.fn((next: string | null) => {
      queryState.integrationTab = next;
    }),
  ]),
}));

vi.mock("@radarboard/ui/app-dialog", () => ({
  APP_DIALOG_SIZES: ["sm", "md", "lg", "xl"],
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({
    children,
    size,
  }: {
    children: ReactNode;
    size: "sm" | "content" | "md" | "lg" | "xl";
  }) => (
    <div data-size={size} data-testid="dialog-content">
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@radarboard/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@radarboard/ui/tabs", () => ({
  Tabs: ({
    children,
    onValueChange: _onValueChange,
    value: _value,
  }: {
    children: ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => <div>{children}</div>,
  TabsList: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  TabsTrigger: ({ children, value: _value }: { children: ReactNode; value: string }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@/components/settings/polling-controls", () => ({
  PollingSourceControls: () => <div data-testid="polling-controls" />,
}));

vi.mock("@/components/shared/remote-service-icon", () => ({
  RemoteServiceIcon: () => null,
}));

vi.mock("@/lib/service-favicons", () => ({
  getServiceFaviconUrl: () => null,
}));

vi.mock("../connection-card", () => ({
  IntegrationConnectionCard: ({
    onCredentialSaveSuccess,
  }: {
    onCredentialSaveSuccess?: () => void;
  }) => (
    <div>
      <div data-testid="connection-card" />
      <button type="button" onClick={() => onCredentialSaveSuccess?.()}>
        Trigger Credential Save Success
      </button>
    </div>
  ),
}));

vi.mock("../flow-wizard", () => ({
  ConfigFlowWizard: () => <div data-testid="config-flow-wizard" />,
}));

vi.mock("../../channels/notification-card", () => ({
  IntegrationNotificationsCard: () => <div data-testid="notifications-card" />,
}));

vi.mock("../../channels/rss-card", () => ({
  IntegrationRssFeedCard: () => <div data-testid="rss-card" />,
}));

vi.mock("../../channels/status-card", () => ({
  IntegrationStatusPageCard: () => <div data-testid="status-card" />,
}));

vi.mock("../../channels/webhook-card", () => ({
  IntegrationWebhookCard: () => <div data-testid="webhook-card" />,
}));

const simpleService = {
  credKey: "app-store-connect",
  auth: {
    name: "App Store Connect",
    type: "api_key",
    fields: [
      { key: "keyId", label: "Key ID", type: "text" },
      { key: "issuerId", label: "Issuer ID", type: "text" },
      { key: "privateKey", label: "Private Key", type: "textarea" },
    ],
  },
  pollingSourceIds: [],
  usedByWidgets: [],
} as ServiceEntry;

const assistantService = {
  ...simpleService,
  credKey: "raindrop",
  auth: {
    name: "Raindrop",
    type: "api_key",
    fields: [{ key: "accessToken", label: "Access Token", type: "password" }],
  },
  mcpConfig: {
    serverName: "raindrop",
    transport: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@adeze/raindrop-mcp@latest"],
    },
    credentialBindings: [],
  },
} as ServiceEntry;

function renderServiceDetailModal(service: ServiceEntry, onOpenChange = vi.fn()) {
  return render(
    <ServiceDetailModal
      service={service}
      connections={[]}
      provider={undefined}
      mcpServers={[]}
      connectedKeys={[]}
      relayUrl=""
      open
      onOpenChange={onOpenChange}
      onManageRelay={vi.fn()}
      apiConfigured={false}
      mcpReady={false}
      saveMcpServer={vi.fn(async () => undefined)}
      testMcpServer={vi.fn(async () => ({ ok: true }))}
      saveConnection={vi.fn(async () => undefined)}
      removeConnection={vi.fn(async () => undefined)}
      onCredentialChange={vi.fn()}
    />
  );
}

describe("ServiceDetailModal", () => {
  beforeEach(() => {
    queryState.integrationTab = null;
  });

  it("uses a small dialog for simple access credential forms", () => {
    renderServiceDetailModal(simpleService);

    expect(screen.getByTestId("dialog-content")).toHaveAttribute("data-size", "sm");
  });

  it.each(["data", "events"] as const)("uses a content dialog for the %s tab", (tab) => {
    queryState.integrationTab = tab;

    renderServiceDetailModal(simpleService);

    expect(screen.getByTestId("dialog-content")).toHaveAttribute("data-size", "content");
  });

  it("left-aligns a single data settings group instead of reserving an empty column", () => {
    queryState.integrationTab = "data";

    renderServiceDetailModal(simpleService);

    expect(screen.getByRole("region", { name: "Integration data settings" })).toHaveClass(
      "max-w-2xl"
    );
    expect(screen.getByTestId("rss-card")).toBeInTheDocument();
    expect(screen.queryByTestId("polling-controls")).not.toBeInTheDocument();
  });

  it("left-aligns a single event settings group when there is no webhook setup", () => {
    queryState.integrationTab = "events";

    renderServiceDetailModal(simpleService);

    expect(screen.getByRole("region", { name: "Integration event settings" })).toHaveClass(
      "max-w-2xl"
    );
    expect(screen.getByTestId("notifications-card")).toBeInTheDocument();
    expect(screen.queryByTestId("webhook-card")).not.toBeInTheDocument();
  });

  it("uses a content dialog when access includes assistant configuration", () => {
    renderServiceDetailModal(assistantService);

    expect(screen.getByTestId("dialog-content")).toHaveAttribute("data-size", "content");
  });

  it("closes after credentials are saved successfully", () => {
    const onOpenChange = vi.fn();
    renderServiceDetailModal(simpleService, onOpenChange);

    fireEvent.click(screen.getByRole("button", { name: "Trigger Credential Save Success" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
