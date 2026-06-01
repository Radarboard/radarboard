"use client";

import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { createMockDataSourceContext } from "@radarboard/integration-sdk/testing";
import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { useCallback, useMemo, useState } from "react";
import "@/lib/integrations-init";

// ---------------------------------------------------------------------------
// Section tabs
// ---------------------------------------------------------------------------

type SandboxSection = "auth" | "data-sources" | "mcp-tools" | "fetch-test";

const SECTION_LABELS: Record<SandboxSection, string> = {
  auth: "Auth Config",
  "data-sources": "Data Sources",
  "mcp-tools": "MCP Tools",
  "fetch-test": "Fetch Tester",
};

// ---------------------------------------------------------------------------
// Auth form preview
// ---------------------------------------------------------------------------

function AuthFormPreview({ descriptor }: { descriptor: IntegrationDescriptor }) {
  const { auth } = descriptor;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-dim text-w-xs uppercase tracking-widest">Auth Type</span>
        <Badge variant="outline" className="font-mono text-w-xs">
          {auth.type}
        </Badge>
        {auth.testEndpoint ? (
          <Badge variant="outline" className="font-mono text-w-xs">
            test: {auth.testEndpoint}
          </Badge>
        ) : null}
      </div>

      {auth.oauth ? (
        <div className="space-y-1 rounded-item border border-border bg-surface p-3">
          <div className="font-mono text-dim text-w-xs uppercase tracking-widest">OAuth Config</div>
          <div className="text-foreground text-w-sm">
            Provider: <code className="text-accent">{auth.oauth.provider}</code>
          </div>
          <div className="text-foreground text-w-sm">
            Scopes: <code className="text-accent">{auth.oauth.scopes.join(", ")}</code>
          </div>
        </div>
      ) : null}

      {auth.fields && auth.fields.length > 0 ? (
        <div className="space-y-2">
          <div className="font-mono text-dim text-w-xs uppercase tracking-widest">
            Credential Fields ({auth.fields.length})
          </div>
          {auth.fields.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between gap-4 rounded-item border border-border bg-surface p-3"
            >
              <div className="min-w-0">
                <div className="font-medium font-mono text-foreground text-w-sm">{field.label}</div>
                <div className="font-mono text-dim text-w-xs">
                  key: {field.key} &middot; type: {field.type}
                  {field.optional ? " (optional)" : ""}
                </div>
                {field.helpText ? (
                  <div className="text-muted-foreground text-w-xs">{field.helpText}</div>
                ) : null}
              </div>
              <input
                type={field.type === "password" ? "password" : "text"}
                disabled
                placeholder={field.placeholder || field.key}
                className="w-48 rounded border border-input bg-muted px-2 py-1 text-dim text-w-sm"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-dim text-w-sm">No credential fields configured.</div>
      )}

      {auth.docsUrl ? (
        <a
          href={auth.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-accent text-w-sm hover:underline"
        >
          API docs &rarr;
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data sources table
// ---------------------------------------------------------------------------

function DataSourceTable({ descriptor }: { descriptor: IntegrationDescriptor }) {
  const dataSources = descriptor.dataSources ?? [];

  if (dataSources.length === 0) {
    return <div className="py-4 text-center text-dim text-w-sm">No data sources declared.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-w-sm">
        <thead>
          <tr className="border-border border-b font-mono text-dim text-w-xs uppercase tracking-widest">
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Cache TTL</th>
            <th className="px-3 py-2">Polling</th>
          </tr>
        </thead>
        <tbody>
          {dataSources.map((ds) => (
            <tr
              key={ds.action}
              className="border-border border-b transition-colors hover:bg-muted/50"
            >
              <td className="px-3 py-2">
                <code className="text-accent">{ds.action}</code>
              </td>
              <td className="px-3 py-2 text-foreground-secondary">{ds.description ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-dim">
                {ds.cacheTtlSeconds ? `${ds.cacheTtlSeconds}s` : "—"}
              </td>
              <td className="px-3 py-2 font-mono text-dim">{ds.pollingSourceId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCP tools listing
// ---------------------------------------------------------------------------

function McpToolsListing({ descriptor }: { descriptor: IntegrationDescriptor }) {
  const tools = descriptor.mcpTools ?? [];

  if (tools.length === 0) {
    return <div className="py-4 text-center text-dim text-w-sm">No MCP tools declared.</div>;
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <div key={tool.name} className="space-y-1 rounded-item border border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <code className="font-medium text-accent text-w-sm">{tool.name}</code>
          </div>
          <p className="text-muted-foreground text-w-sm">{tool.description}</p>
          {tool.parameters ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-mono text-dim text-w-xs">
                Parameters schema
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-dim text-w-xs">
                {JSON.stringify(
                  "shape" in tool.parameters
                    ? Object.keys((tool.parameters as { shape: Record<string, unknown> }).shape)
                    : tool.parameters,
                  null,
                  2
                )}
              </pre>
            </details>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data source fetch tester
// ---------------------------------------------------------------------------

function DataSourceFetchTester({ descriptor }: { descriptor: IntegrationDescriptor }) {
  const dataSources = descriptor.dataSources ?? [];
  const [testerState, setTesterState] = useState<{
    credentials: Record<string, string>;
    fetchError: string | null;
    result: string | null;
    running: boolean;
    selectedAction: string;
  }>({
    credentials: {},
    fetchError: null,
    result: null,
    running: false,
    selectedAction: dataSources[0]?.action ?? "",
  });
  const { credentials, fetchError, result, running, selectedAction } = testerState;

  const selectedDs = dataSources.find((ds) => ds.action === selectedAction);

  const runFetch = useCallback(async () => {
    if (!selectedDs?.fetch) return;
    setTesterState((current) => ({
      ...current,
      running: true,
      result: null,
      fetchError: null,
    }));

    try {
      const ctx = createMockDataSourceContext({
        [descriptor.auth.id]: credentials,
      });

      const data = await selectedDs.fetch(
        {
          projectSlug: "test-project",
          range: "30d",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          forceRefresh: false,
        },
        ctx
      );

      setTesterState((current) => ({
        ...current,
        result: JSON.stringify(data, null, 2),
      }));
    } catch (err) {
      setTesterState((current) => ({
        ...current,
        fetchError: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setTesterState((current) => ({ ...current, running: false }));
    }
  }, [selectedDs, credentials, descriptor.auth.id]);

  if (dataSources.length === 0) {
    return <div className="py-4 text-center text-dim text-w-sm">No data sources to test.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-dim text-w-sm" htmlFor="fetch-ds-select">
          Data Source:
        </label>
        <select
          id="fetch-ds-select"
          value={selectedAction}
          onChange={(e) =>
            setTesterState((current) => ({ ...current, selectedAction: e.target.value }))
          }
          className="rounded border border-input bg-surface px-2 py-1 text-foreground text-w-sm"
        >
          {dataSources.map((ds) => (
            <option key={ds.action} value={ds.action}>
              {ds.action}
            </option>
          ))}
        </select>
      </div>

      {/* Credential inputs */}
      {descriptor.auth.fields && descriptor.auth.fields.length > 0 ? (
        <div className="space-y-2">
          <div className="font-mono text-dim text-w-xs uppercase tracking-widest">
            Test Credentials
          </div>
          {descriptor.auth.fields.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <label
                htmlFor={`cred-${field.key}`}
                className="w-32 font-mono text-foreground-secondary text-w-sm"
              >
                {field.label}
              </label>
              <input
                id={`cred-${field.key}`}
                type={field.type === "password" ? "password" : "text"}
                placeholder={field.placeholder || field.key}
                value={credentials[field.key] ?? ""}
                onChange={(e) =>
                  setTesterState((current) => ({
                    ...current,
                    credentials: { ...current.credentials, [field.key]: e.target.value },
                  }))
                }
                className="flex-1 rounded border border-input bg-surface px-2 py-1 text-foreground text-w-sm"
              />
            </div>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={runFetch}
        disabled={running || !selectedDs?.fetch}
        className="font-mono text-w-xs"
      >
        {running ? "Running..." : "Run Fetch"}
      </Button>

      {result ? (
        <pre className="max-h-80 overflow-auto rounded-item border border-border bg-surface p-3 font-mono text-foreground-secondary text-w-xs">
          {result}
        </pre>
      ) : null}

      {fetchError ? (
        <div className="rounded-item border border-destructive/30 bg-destructive/5 p-3">
          <p className="font-mono text-destructive text-w-sm">{fetchError}</p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main sandbox
// ---------------------------------------------------------------------------

export function IntegrationSandbox() {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SandboxSection>("auth");

  const integrations = useMemo(() => {
    return getAllIntegrations().sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const descriptor = integrations.find((i) => i.id === selectedIntegration) ?? null;

  return (
    <div className="space-y-5 text-foreground-secondary">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 border-border border-b pb-4">
        <label className="text-dim text-w-sm" htmlFor="sandbox-integration-select">
          Integration:
        </label>
        <select
          id="sandbox-integration-select"
          value={selectedIntegration ?? ""}
          onChange={(e) => setSelectedIntegration(e.target.value || null)}
          className="rounded border border-input bg-surface px-2 py-1 text-foreground text-w-sm"
        >
          <option value="">Select an integration...</option>
          {integrations.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.category})
            </option>
          ))}
        </select>
      </div>

      {descriptor ? (
        <div className="space-y-4">
          {/* Section tabs */}
          <div className="flex gap-1 border-border border-b">
            {(Object.entries(SECTION_LABELS) as Array<[SandboxSection, string]>).map(
              ([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    "h-auto rounded-none border-b-2 px-3 py-2 font-mono text-w-sm transition-colors",
                    activeSection === id
                      ? "border-accent text-foreground"
                      : "border-transparent text-dim hover:text-foreground-secondary"
                  )}
                >
                  {label}
                  {id === "data-sources" && descriptor.dataSources
                    ? ` (${descriptor.dataSources.length})`
                    : ""}
                  {id === "mcp-tools" && descriptor.mcpTools
                    ? ` (${descriptor.mcpTools.length})`
                    : ""}
                </Button>
              )
            )}
          </div>

          {/* Section content */}
          <div style={{ minHeight: 300 }}>
            {activeSection === "auth" && <AuthFormPreview descriptor={descriptor} />}
            {activeSection === "data-sources" && <DataSourceTable descriptor={descriptor} />}
            {activeSection === "mcp-tools" && <McpToolsListing descriptor={descriptor} />}
            {activeSection === "fetch-test" && <DataSourceFetchTester descriptor={descriptor} />}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-dim">
          Select an integration to inspect its descriptor.
        </div>
      )}
    </div>
  );
}
