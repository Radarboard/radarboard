"use client";

import type { IntegrationConnection } from "@radarboard/types/database";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { cn } from "@radarboard/utils/cn";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OAuthServiceCard } from "@/components/credentials/oauth-service-card";
import type {
  McpConnectionTestPayload,
  McpConnectionTestResult,
  ServiceEntry,
} from "@/components/settings/settings-integrations/types";
import {
  buildInitialLinkedMcpDraft,
  buildLinkedMcpServer,
  createConnectionDraft,
  fetchCredentialValues,
  getDefaultServiceConnection,
  getLinkedMcpServerForConnection,
  pickEditableCredentialValues,
} from "@/components/settings/settings-integrations/utils";
import type { IntegrationProviderDefinition } from "@/hooks/settings/use-integration-connections";
import { ApiCredentialAccessCard } from "./api-access";
import { LinkedAssistantAccessCard } from "./assistant-access";
import { ProviderConnectionManagerCard } from "./connection-manager";

function ModalSection({
  title,
  description,
  children,
  className,
  headerRight,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-4 border border-border bg-surface p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-muted-foreground text-w-sm uppercase tracking-[0.18em]">
            {title}
          </div>
          <div className="mt-1 text-foreground-secondary text-w-base">{description}</div>
        </div>
        {headerRight !== undefined ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function IntegrationConnectionCard({
  service,
  connections,
  provider,
  mcpServers,
  connectedKeys,
  saveMcpServer,
  testMcpServer,
  saveConnection,
  removeConnection,
  onCredentialChange,
  onCredentialSaveSuccess,
}: {
  service: ServiceEntry;
  connections: IntegrationConnection[];
  provider: IntegrationProviderDefinition | undefined;
  mcpServers: McpServerConfig[];
  connectedKeys: string[];
  saveMcpServer: (server: McpServerConfig) => Promise<void>;
  testMcpServer: (payload: McpConnectionTestPayload) => Promise<McpConnectionTestResult>;
  saveConnection: (connection: IntegrationConnection) => Promise<void>;
  removeConnection: (connectionId: string) => Promise<void>;
  onCredentialChange: () => Promise<void> | void;
  onCredentialSaveSuccess?: () => void;
}) {
  const isOAuth = service.auth.type === "oauth" && service.auth.oauth && service.auth.fields;
  const isApiKey = service.auth.type === "api_key" && service.auth.fields;
  const [credentialState, setCredentialState] = useState<{
    values: Record<string, string>;
    loaded: boolean;
  }>({
    values: {},
    loaded: false,
  });
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    getDefaultServiceConnection(service, connections)?.id ?? null
  );

  const selectedConnection = useMemo(
    () =>
      connections.find((connection) => connection.id === selectedConnectionId) ??
      getDefaultServiceConnection(service, connections),
    [connections, selectedConnectionId, service]
  );
  const activeCredentialKey = selectedConnection?.credentialKey ?? service.credKey;
  const selectedLinkedServer = useMemo(
    () => getLinkedMcpServerForConnection(service, selectedConnection ?? null, mcpServers),
    [mcpServers, selectedConnection, service]
  );
  const selectedApiConnected = connectedKeys.includes(activeCredentialKey);
  const supportsAssistantAccess = Boolean(service.mcpConfig || selectedLinkedServer);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let nextValues: Record<string, string> = {};

      try {
        const storedValues = await fetchCredentialValues(activeCredentialKey);
        nextValues = pickEditableCredentialValues(storedValues, service.auth.fields);
      } catch {
        nextValues = {};
      }

      if (cancelled) return;
      setCredentialState({ values: nextValues, loaded: true });
    })().catch(() => {
      /* fire-and-forget */
    });

    return () => {
      cancelled = true;
    };
  }, [activeCredentialKey, service.auth.fields]);

  useEffect(() => {
    if (!selectedConnectionId && connections.length > 0) {
      setSelectedConnectionId(
        getDefaultServiceConnection(service, connections)?.id ?? connections[0]?.id ?? null
      );
      return;
    }

    if (
      selectedConnectionId &&
      !connections.some((connection) => connection.id === selectedConnectionId)
    ) {
      setSelectedConnectionId(
        getDefaultServiceConnection(service, connections)?.id ?? connections[0]?.id ?? null
      );
    }
  }, [connections, selectedConnectionId, service]);

  const handleCreateConnection = useCallback(async () => {
    const nextConnection = createConnectionDraft(service, provider, connections);
    await saveConnection(nextConnection);
    setSelectedConnectionId(nextConnection.id);
  }, [connections, provider, saveConnection, service]);

  const handleSaveConnection = useCallback(
    async (connection: IntegrationConnection) => {
      await saveConnection(connection);
      setSelectedConnectionId(connection.id);
    },
    [saveConnection]
  );

  const handleDeleteConnection = useCallback(
    async (connection: IntegrationConnection) => {
      await removeConnection(connection.id);
      if (selectedConnectionId === connection.id) {
        const remaining = connections.filter((entry) => entry.id !== connection.id);
        setSelectedConnectionId(
          getDefaultServiceConnection(service, remaining)?.id ?? remaining[0]?.id ?? null
        );
      }
    },
    [connections, removeConnection, selectedConnectionId, service]
  );

  const handleCredentialSaved = useCallback(
    async (payload: { credentialKey: string; values: Record<string, string> }) => {
      if (!service.mcpConfig) return;

      const hasMissingBindings = (service.mcpConfig.credentialBindings ?? []).some(
        (binding) => !(payload.values[binding.sourceField]?.trim().length ?? 0)
      );
      if (hasMissingBindings) return;

      let nextConnection = selectedConnection;

      if (!nextConnection) {
        nextConnection = createConnectionDraft(service, provider, connections);
        await saveConnection(nextConnection);
        setSelectedConnectionId(nextConnection.id);
      }

      const linkedServer = getLinkedMcpServerForConnection(service, nextConnection, mcpServers);
      const draft = buildInitialLinkedMcpDraft(service, linkedServer);
      if (!draft) return;

      const buildResult = buildLinkedMcpServer(service, nextConnection, {
        ...draft,
        enabled: true,
      });
      if (!buildResult.ok) return;

      await saveMcpServer(buildResult.value);
    },
    [connections, mcpServers, provider, saveConnection, saveMcpServer, selectedConnection, service]
  );

  if (!credentialState.loaded) {
    return (
      <ModalSection title="Access" description="Loading integration access settings.">
        <div className="font-mono text-dim text-w-sm">Loading access settings...</div>
      </ModalSection>
    );
  }

  return (
    <div className={cn("grid gap-4", supportsAssistantAccess ? "xl:grid-cols-2" : "grid-cols-1")}>
      <div className="space-y-4">
        {Boolean(isOAuth || isApiKey) && (
          <ModalSection
            title="Radarboard Access"
            description={
              isOAuth
                ? "Manage OAuth app credentials and connect this service."
                : "Manage the credentials Radarboard uses to talk to this service."
            }
            headerRight={
              <span
                className={cn(
                  "border border-border px-2 py-0.5 font-mono text-w-sm",
                  selectedApiConnected ? "text-success" : "text-muted-foreground"
                )}
              >
                {selectedApiConnected ? "Configured" : "Not configured"}
              </span>
            }
          >
            {isOAuth ? (
              <OAuthServiceCard
                credKey={selectedConnection?.credentialKey ?? service.credKey}
                service={service.auth}
                isConnected={selectedApiConnected}
                onCredentialChange={() => onCredentialChange()}
              />
            ) : (
              <ApiCredentialAccessCard
                service={service}
                credentialKey={activeCredentialKey}
                values={credentialState.values}
                setValues={(updater) =>
                  setCredentialState((current) => ({
                    ...current,
                    values: updater(current.values),
                  }))
                }
                onCredentialSaved={handleCredentialSaved}
                onCredentialSaveSuccess={onCredentialSaveSuccess}
                onCredentialChange={onCredentialChange}
              />
            )}
          </ModalSection>
        )}

        {supportsAssistantAccess ? (
          <ProviderConnectionManagerCard
            provider={provider}
            connections={connections}
            selectedConnectionId={selectedConnection?.id ?? null}
            onSelectConnection={setSelectedConnectionId}
            onCreateConnection={() => handleCreateConnection()}
            onSaveConnection={(connection) => handleSaveConnection(connection)}
            onDeleteConnection={(connection) => handleDeleteConnection(connection)}
          />
        ) : null}
      </div>

      {supportsAssistantAccess ? (
        <div className="space-y-4">
          <ModalSection
            title="Assistant Access"
            description="Configure the MCP server the assistant should use for this service."
            className="h-full"
          >
            {selectedConnection ? (
              <LinkedAssistantAccessCard
                service={service}
                connection={selectedConnection}
                apiValues={credentialState.values}
                linkedServer={selectedLinkedServer}
                saveMcpServer={saveMcpServer}
                testMcpServer={testMcpServer}
                onChange={onCredentialChange}
              />
            ) : (
              <div className="border border-border bg-surface-raised p-4 text-foreground-secondary text-w-base">
                Create a connection before configuring assistant access.
              </div>
            )}
          </ModalSection>
        </div>
      ) : null}
    </div>
  );
}
