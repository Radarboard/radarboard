"use client";

import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Loader2, Trash2 } from "lucide-react";
import { getMcpServerSummary } from "@/lib/mcp/mcp-server-config";
import { CollapsibleListPanel, ListPanelHeader } from "../settings-list-panel";

// ---------------------------------------------------------------------------
// Types re-exported for parent
// ---------------------------------------------------------------------------

export type ConnectionState = "idle" | "testing" | "ok" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateText(value: string, maxLen = 40): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
}

function getManagedIntegration(serverName: string) {
  for (const descriptor of INTEGRATION_REGISTRY.values()) {
    if (!descriptor.mcp) continue;
    const managedNames = [descriptor.mcp.serverName, ...(descriptor.mcp.aliases ?? [])];
    if (managedNames.includes(serverName)) {
      return descriptor;
    }
  }
  return null;
}

export function filterServersByManagedStatus(servers: McpServerConfig[]) {
  const custom = servers.filter((server) => !getManagedIntegration(server.name));
  const managed = servers.filter((server) => Boolean(getManagedIntegration(server.name)));
  return { custom, managed };
}

function getConnectionIndicator(
  server: McpServerConfig,
  connectionState: ConnectionState
): { className: string; title: string } {
  if (!server.enabled) {
    return { className: "bg-muted", title: "Disabled" };
  }
  switch (connectionState) {
    case "ok":
      return { className: "bg-success", title: "Connection verified" };
    case "error":
      return { className: "bg-destructive", title: "Connection failed" };
    default:
      return { className: "bg-dim", title: "Connection unverified" };
  }
}

export function filterServersBySearch(
  servers: McpServerConfig[],
  serverSearch: string
): McpServerConfig[] {
  if (!serverSearch.trim()) return servers;
  const query = serverSearch.toLowerCase();
  return servers.filter((server) => {
    const summary = getMcpServerSummary(server).toLowerCase();
    return server.name.toLowerCase().includes(query) || summary.includes(query);
  });
}

// ---------------------------------------------------------------------------
// ServerListItem
// ---------------------------------------------------------------------------

interface ServerListItemProps {
  server: McpServerConfig;
  connectionState: ConnectionState;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ServerListItem({
  server,
  connectionState,
  isSelected,
  onSelect,
  onDelete,
  isDeleting,
}: ServerListItemProps) {
  const summary = getMcpServerSummary(server);
  const indicator = getConnectionIndicator(server, connectionState);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 border-border border-b px-3 py-2.5 transition-colors",
        isSelected ? "bg-secondary" : "hover:bg-surface-raised"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="uppercase-none flex h-auto min-w-0 flex-1 items-center gap-2 p-0 text-left font-normal hover:bg-transparent"
        onClick={onSelect}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", indicator.className)} />
          </TooltipTrigger>
          <TooltipContent>{indicator.title}</TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-foreground text-w-base">{server.name}</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="truncate font-mono text-dim text-w-xs">{truncateText(summary)}</div>
            </TooltipTrigger>
            <TooltipContent>{summary}</TooltipContent>
          </Tooltip>
        </div>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={isDeleting}
        className={cn(
          "uppercase-none h-7 w-7 shrink-0 text-dim transition-colors",
          "opacity-0 group-hover:opacity-100",
          isSelected && "opacity-100",
          isDeleting ? "cursor-not-allowed" : "hover:bg-destructive/10 hover:text-destructive"
        )}
        aria-label={`Delete MCP server ${server.name}`}
      >
        {isDeleting ? <Loader2 className="icon-xs animate-spin" /> : <Trash2 className="icon-xs" />}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ManagedServerList
// ---------------------------------------------------------------------------

function ManagedServerList({
  servers,
  connectionStateByName,
}: {
  servers: McpServerConfig[];
  connectionStateByName: Record<string, ConnectionState>;
}) {
  if (servers.length === 0) return null;

  return (
    <div className="space-y-3 border-border border-t p-3">
      <div>
        <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
          Managed By Integrations
        </div>
        <div className="mt-1 font-mono text-dim text-w-xs">
          Linked servers are configured from the Integrations page.
        </div>
      </div>

      <div className="space-y-2">
        {servers.map((server) => {
          const managedIntegration = getManagedIntegration(server.name);
          const indicator = getConnectionIndicator(
            server,
            connectionStateByName[server.name] ?? "idle"
          );

          return (
            <div
              key={server.name}
              className="rounded-item border border-border bg-surface px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", indicator.className)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{indicator.title}</TooltipContent>
                    </Tooltip>
                    <div className="truncate font-mono text-foreground text-w-base">
                      {server.name}
                    </div>
                  </div>
                  <div className="mt-1 truncate font-mono text-dim text-w-xs">
                    {managedIntegration?.name ?? "Linked integration"}
                  </div>
                </div>

                <span className="shrink-0 rounded-item bg-secondary px-2 py-0.5 font-mono text-dim text-w-sm">
                  Integrations
                </span>
              </div>

              <div className="mt-2 truncate font-mono text-dim text-w-xs">
                {truncateText(getMcpServerSummary(server), 56)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ServerListPanel
// ---------------------------------------------------------------------------

interface ServerListPanelProps {
  loading: boolean;
  error: string | null;
  filteredCustomServers: McpServerConfig[];
  filteredManagedServers: McpServerConfig[];
  connectionStateByName: Record<string, ConnectionState>;
  selectedName: string | null;
  deletingName: string | null;
  showForm: boolean;
  servers: McpServerConfig[];
  serverSearch: string;
  onSearchChange: (value: string) => void;
  onAddNew: () => void;
  onSelectServer: (server: McpServerConfig) => void;
  onDeleteServer: (name: string) => void;
}

export function ServerListPanel({
  loading,
  error,
  filteredCustomServers,
  filteredManagedServers,
  connectionStateByName,
  selectedName,
  deletingName,
  showForm,
  servers,
  serverSearch,
  onSearchChange,
  onAddNew,
  onSelectServer,
  onDeleteServer,
}: ServerListPanelProps) {
  return (
    <CollapsibleListPanel>
      <ListPanelHeader
        title="Custom MCP Servers"
        subtitle="Add standalone servers. Linked integration servers are shown below."
        searchPlaceholder="Search servers…"
        searchValue={serverSearch}
        onSearchChange={onSearchChange}
        onAdd={onAddNew}
        addLabel="Add new MCP server"
      />

      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">
        {Boolean(loading) && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="icon-sm animate-spin text-dim" />
          </div>
        )}

        {!loading && error && (
          <div className="px-3 py-4 font-mono text-destructive text-w-xs">{error}</div>
        )}

        {!loading &&
          !error &&
          filteredCustomServers.length === 0 &&
          filteredManagedServers.length === 0 &&
          !showForm && (
            <div className="px-3 py-4 text-center font-mono text-dim text-w-xs">
              {servers.length === 0 ? "No servers yet" : "No servers match your search."}
            </div>
          )}

        {!loading &&
          filteredCustomServers.map((server) => (
            <ServerListItem
              key={server.name}
              server={server}
              connectionState={connectionStateByName[server.name] ?? "idle"}
              isSelected={selectedName === server.name}
              onSelect={() => onSelectServer(server)}
              onDelete={() => onDeleteServer(server.name)}
              isDeleting={deletingName === server.name}
            />
          ))}

        {!loading && !error && (
          <ManagedServerList
            servers={filteredManagedServers}
            connectionStateByName={connectionStateByName}
          />
        )}
      </div>
    </CollapsibleListPanel>
  );
}
