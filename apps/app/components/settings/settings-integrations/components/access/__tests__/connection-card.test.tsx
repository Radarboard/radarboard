// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCredentialReference } from "@/lib/mcp/mcp-server-config";
import { IntegrationConnectionCard } from "../connection-card";

const fetchCredentialValuesMock = vi.fn();
const apiAccessPropsSpy = vi.fn();

vi.mock("@/components/settings/settings-integrations/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/settings/settings-integrations/utils")>();
  return {
    ...actual,
    fetchCredentialValues: (...args: unknown[]) => fetchCredentialValuesMock(...args),
  };
});

vi.mock("../api-access", () => ({
  ApiCredentialAccessCard: (props: unknown) => {
    apiAccessPropsSpy(props);
    return (
      <div>
        <div data-testid="api-access-card" />
        <button
          type="button"
          onClick={() =>
            (
              props as {
                credentialKey: string;
                values: Record<string, string>;
                onCredentialSaved?: (payload: {
                  credentialKey: string;
                  values: Record<string, string>;
                }) => Promise<void> | void;
              }
            ).onCredentialSaved?.({
              credentialKey: (props as { credentialKey: string }).credentialKey,
              values: (props as { values: Record<string, string> }).values,
            })
          }
        >
          Trigger Credential Save
        </button>
      </div>
    );
  },
}));

vi.mock("../assistant-access", () => ({
  LinkedAssistantAccessCard: () => <div data-testid="assistant-access-card" />,
}));

const service = {
  credKey: "openpanel",
  auth: {
    name: "OpenPanel",
    type: "api_key",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  pollingSourceIds: [],
  usedByWidgets: [],
};

const raindropService = {
  credKey: "raindrop",
  auth: {
    name: "Raindrop",
    type: "api_key",
    fields: [{ key: "accessToken", label: "Access Token", type: "password" }],
  },
  pollingSourceIds: [],
  usedByWidgets: [],
  mcpConfig: {
    serverName: "raindrop",
    docsUrl: "https://www.npmjs.com/package/@adeze/raindrop-mcp",
    transport: {
      type: "stdio" as const,
      command: "npx",
      args: ["-y", "@adeze/raindrop-mcp@latest"],
    },
    credentialBindings: [
      {
        sourceField: "accessToken",
        target: { type: "env" as const, key: "RAINDROP_ACCESS_TOKEN" },
      },
    ],
  },
};

describe("IntegrationConnectionCard", () => {
  beforeEach(() => {
    fetchCredentialValuesMock.mockReset();
    apiAccessPropsSpy.mockReset();
  });

  it("treats the base service credential as configured when no explicit connection exists", async () => {
    fetchCredentialValuesMock.mockResolvedValue({
      clientId: "cid",
      clientSecret: "secret",
    });

    render(
      <IntegrationConnectionCard
        service={service}
        connections={[]}
        provider={undefined}
        mcpServers={[]}
        connectedKeys={["openpanel"]}
        saveMcpServer={vi.fn(async () => undefined)}
        testMcpServer={vi.fn(async () => ({ ok: true }))}
        saveConnection={vi.fn(async () => undefined)}
        removeConnection={vi.fn(async () => undefined)}
        onCredentialChange={vi.fn()}
      />
    );

    await screen.findByTestId("api-access-card");
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.queryByText("Connections")).toBeNull();
    expect(screen.queryByText("Assistant Access")).toBeNull();

    await waitFor(() => {
      expect(fetchCredentialValuesMock).toHaveBeenCalledWith("openpanel");
      expect(apiAccessPropsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialKey: "openpanel",
          values: expect.objectContaining({ clientId: "cid", clientSecret: "secret" }),
        })
      );
    });
  });

  it("shows assistant-only sections for preset-backed services", async () => {
    fetchCredentialValuesMock.mockResolvedValue({
      accessToken: "token-value",
    });

    render(
      <IntegrationConnectionCard
        service={raindropService}
        connections={[]}
        provider={undefined}
        mcpServers={[]}
        connectedKeys={["raindrop"]}
        saveMcpServer={vi.fn(async () => undefined)}
        testMcpServer={vi.fn(async () => ({ ok: true }))}
        saveConnection={vi.fn(async () => undefined)}
        removeConnection={vi.fn(async () => undefined)}
        onCredentialChange={vi.fn()}
      />
    );

    await screen.findByText("Radarboard Access");
    expect(
      screen.getByText("Optional profiles for assistant access. 0 configured.")
    ).toBeInTheDocument();
    expect(screen.getByText("Assistant Access")).toBeInTheDocument();
  });

  it("auto-provisions assistant access when a preset-backed service credentials are saved", async () => {
    fetchCredentialValuesMock.mockResolvedValue({
      accessToken: "token-value",
    });

    const saveConnection = vi.fn(async () => undefined);
    const saveMcpServer = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <IntegrationConnectionCard
        service={raindropService}
        connections={[]}
        provider={undefined}
        mcpServers={[]}
        connectedKeys={["raindrop"]}
        saveMcpServer={saveMcpServer}
        testMcpServer={vi.fn(async () => ({ ok: true }))}
        saveConnection={saveConnection}
        removeConnection={vi.fn(async () => undefined)}
        onCredentialChange={vi.fn()}
      />
    );

    await screen.findByTestId("api-access-card");
    await user.click(screen.getByRole("button", { name: "Trigger Credential Save" }));

    await waitFor(() => {
      expect(saveConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "raindrop::default",
          provider: "raindrop",
          credentialKey: "raindrop",
          isDefault: true,
        })
      );
      expect(saveMcpServer).toHaveBeenCalledWith({
        name: "raindrop",
        type: "stdio",
        command: "npx",
        args: ["-y", "@adeze/raindrop-mcp@latest"],
        env: {
          RAINDROP_ACCESS_TOKEN: buildCredentialReference("raindrop", "accessToken"),
        },
        docsUrl: "https://www.npmjs.com/package/@adeze/raindrop-mcp",
        enabled: true,
      });
    });
  });
});
