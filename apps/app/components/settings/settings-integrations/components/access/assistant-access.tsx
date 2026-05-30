"use client";

import type { IntegrationConnection } from "@radarboard/types/database";
import type { McpServerConfig } from "@radarboard/types/mcp-server";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { Switch } from "@radarboard/ui/switch";
import { Textarea } from "@radarboard/ui/textarea";
import { cn } from "@radarboard/utils/cn";
import { ExternalLink, Loader2 } from "lucide-react";
import { useAssistantAccessController } from "@/components/settings/settings-integrations/hooks";
import type {
  LinkedMcpDraft,
  McpConnectionTestPayload,
  McpConnectionTestResult,
  ServiceEntry,
} from "@/components/settings/settings-integrations/types";
import { handleExternalLinkClick } from "@/lib/system/ui/external-url";

function AssistantAccessHeader({
  status,
  linkedServer,
  enabled,
  togglingActive,
  onToggleActive,
  showConfig,
  onToggleConfig,
  serviceName,
}: {
  status: { label: string; className: string };
  linkedServer: McpServerConfig | null;
  enabled: boolean;
  togglingActive: boolean;
  onToggleActive: (checked: boolean) => void;
  showConfig: boolean;
  onToggleConfig: () => void;
  serviceName: string;
}) {
  return (
    <div className="flex items-center justify-between border border-border bg-surface-raised px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-foreground-secondary text-w-sm">Assistant MCP</span>
        <span className={cn("border px-2 py-0.5 font-mono text-w-sm", status.className)}>
          {status.label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {linkedServer ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground text-w-sm">Active</span>
            <Switch
              checked={enabled}
              disabled={togglingActive}
              onCheckedChange={onToggleActive}
              aria-label={`Toggle assistant access for ${serviceName}`}
            />
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onToggleConfig}
          uppercase={false}
          className="h-auto px-2.5 py-1 font-mono text-foreground-secondary text-w-sm hover:text-foreground"
        >
          {(() => {
            if (showConfig) return "Done";
            if (linkedServer) return "Edit MCP";
            return "Configure MCP";
          })()}
        </Button>
      </div>
    </div>
  );
}

function AssistantTransportPicker({
  draftType,
  onSelect,
}: {
  draftType: LinkedMcpDraft["type"];
  onSelect: (transportType: LinkedMcpDraft["type"]) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Transport</div>
      <div className="inline-flex rounded-item border border-border bg-surface p-1">
        {(["streamable-http", "stdio"] as const).map((transportType) => (
          <Button
            key={transportType}
            type="button"
            variant="ghost"
            onClick={() => onSelect(transportType)}
            uppercase={false}
            className={cn(
              "h-auto rounded-item px-3 py-1.5 font-mono font-normal text-w-sm transition-colors",
              draftType === transportType
                ? "bg-secondary text-foreground"
                : "text-dim hover:bg-transparent hover:text-foreground-secondary"
            )}
          >
            {transportType === "streamable-http" ? "HTTP" : "stdio"}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AssistantTransportSummary({ draft }: { draft: LinkedMcpDraft }) {
  const getSummary = () => {
    if (draft.type === "stdio") {
      return draft.command
        ? `${draft.command}${draft.argsText.trim() ? ` ${draft.argsText.split("\n").join(" ")}` : ""}`
        : "No command configured";
    }
    return draft.url || "No URL configured";
  };
  const summary = getSummary();

  return (
    <div className="rounded-item border border-border bg-surface px-3 py-2 font-mono text-muted-foreground text-w-sm">
      {summary}
    </div>
  );
}

function AssistantConfigFields({
  draft,
  hasPreset,
  hasAuthHeaderBinding,
  onDraftChange,
}: {
  draft: LinkedMcpDraft;
  hasPreset: boolean;
  hasAuthHeaderBinding: boolean;
  onDraftChange: (updater: (draft: LinkedMcpDraft) => LinkedMcpDraft) => void;
}) {
  return (
    <div className="space-y-3 rounded-item border border-border bg-secondary/30 p-3">
      {draft.type === "stdio" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="mcp-command">Command</Label>
            <Input
              id="mcp-command"
              type="text"
              value={draft.command}
              onChange={(event) =>
                onDraftChange((current) =>
                  current.type === "stdio" ? { ...current, command: event.target.value } : current
                )
              }
              size="lg"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mcp-args">Arguments</Label>
            <Textarea
              id="mcp-args"
              value={draft.argsText}
              onChange={(event) =>
                onDraftChange((current) =>
                  current.type === "stdio" ? { ...current, argsText: event.target.value } : current
                )
              }
              className="min-h-[88px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mcp-cwd">Working Directory</Label>
            <Input
              id="mcp-cwd"
              type="text"
              value={draft.cwd}
              onChange={(event) =>
                onDraftChange((current) =>
                  current.type === "stdio" ? { ...current, cwd: event.target.value } : current
                )
              }
              size="lg"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mcp-env">Extra Environment Variables</Label>
            <Textarea
              id="mcp-env"
              value={draft.envText}
              onChange={(event) =>
                onDraftChange((current) =>
                  current.type === "stdio" ? { ...current, envText: event.target.value } : current
                )
              }
              className="min-h-[88px]"
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="mcp-url">URL</Label>
            <Input
              id="mcp-url"
              type="url"
              value={draft.url}
              onChange={(event) =>
                onDraftChange((current) =>
                  current.type === "streamable-http"
                    ? { ...current, url: event.target.value }
                    : current
                )
              }
              size="lg"
            />
          </div>
          {!hasPreset || !hasAuthHeaderBinding ? (
            <div className="space-y-1">
              <Label htmlFor="mcp-auth">Authorization Header</Label>
              <Input
                id="mcp-auth"
                type="password"
                value={draft.authHeader}
                onChange={(event) =>
                  onDraftChange((current) =>
                    current.type === "streamable-http"
                      ? { ...current, authHeader: event.target.value }
                      : current
                  )
                }
                placeholder="Bearer <token>"
                size="lg"
              />
            </div>
          ) : null}
        </>
      )}

      <div className="space-y-1">
        <Label htmlFor="mcp-docs">Documentation URL</Label>
        <Input
          id="mcp-docs"
          type="url"
          value={draft.docsUrl}
          onChange={(event) =>
            onDraftChange((current) => ({ ...current, docsUrl: event.target.value }))
          }
          size="lg"
        />
      </div>
    </div>
  );
}

function AssistantActionRow({
  canPersist,
  testing,
  saving,
  onTest,
  onSave,
}: {
  canPersist: boolean;
  testing: boolean;
  saving: boolean;
  onTest: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button
        type="button"
        variant="outline"
        onClick={onTest}
        disabled={!canPersist || testing}
        uppercase={false}
        className="h-auto px-3 py-1 font-mono text-dim text-w-sm hover:text-foreground-secondary disabled:opacity-40"
      >
        {testing ? <Loader2 className="icon-xs animate-spin" /> : "Test Connection"}
      </Button>
      <Button
        type="button"
        onClick={onSave}
        disabled={!canPersist || saving}
        uppercase={false}
        className="h-auto px-3 py-1 font-mono text-w-sm"
      >
        {saving ? <Loader2 className="icon-xs animate-spin" /> : "Save Assistant Access"}
      </Button>
    </div>
  );
}

export function LinkedAssistantAccessCard({
  service,
  connection,
  apiValues,
  linkedServer,
  saveMcpServer,
  testMcpServer,
  onChange,
}: {
  service: ServiceEntry;
  connection: IntegrationConnection | null;
  apiValues: Record<string, string>;
  linkedServer: McpServerConfig | null;
  saveMcpServer: (server: McpServerConfig) => Promise<void>;
  testMcpServer: (payload: McpConnectionTestPayload) => Promise<McpConnectionTestResult>;
  onChange: () => Promise<void> | void;
}) {
  const {
    draft,
    setDraft,
    showConfig,
    setShowConfig,
    saving,
    testing,
    togglingActive,
    feedback,
    hasPreset,
    docsUrl,
    hasMissingBindings,
    missingBindingLabels,
    hasAuthHeaderBinding,
    canPersist,
    status,
    handleSave,
    handleTest,
    handleToggleActive,
  } = useAssistantAccessController({
    service,
    connection,
    apiValues,
    linkedServer,
    saveMcpServer,
    testMcpServer,
    onChange,
  });

  if (!draft || !connection) return null;

  return (
    <div className="space-y-3">
      <AssistantAccessHeader
        status={status}
        linkedServer={linkedServer}
        enabled={draft.enabled}
        togglingActive={togglingActive}
        onToggleActive={(checked) => handleToggleActive(checked)}
        showConfig={showConfig}
        onToggleConfig={() => setShowConfig((value) => !value)}
        serviceName={service.auth.name ?? service.credKey}
      />

      {showConfig && !hasPreset ? (
        <AssistantTransportPicker
          draftType={draft.type}
          onSelect={(transportType) =>
            setDraft((prev) => {
              if (!prev || prev.type === transportType) return prev;

              return transportType === "stdio"
                ? {
                    type: "stdio",
                    enabled: prev.enabled,
                    command: "",
                    argsText: "",
                    cwd: "",
                    envText: "",
                    docsUrl: prev.docsUrl,
                  }
                : {
                    type: "streamable-http",
                    enabled: prev.enabled,
                    url: "",
                    authHeader: "",
                    docsUrl: prev.docsUrl,
                  };
            })
          }
        />
      ) : null}

      {linkedServer ? <AssistantTransportSummary draft={draft} /> : null}

      {showConfig ? <AssistantTransportSummary draft={draft} /> : null}

      {showConfig && docsUrl ? (
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => handleExternalLinkClick(event, docsUrl)}
          className="inline-flex items-center gap-1.5 font-mono text-accent text-w-sm transition-colors hover:text-accent/80"
        >
          MCP server documentation
          <ExternalLink className="icon-xs" />
        </a>
      ) : null}

      {showConfig && hasPreset && hasMissingBindings ? (
        <div className="rounded-item border border-warning/30 border-dashed bg-warning/10 p-3 text-w-sm text-warning leading-relaxed">
          Needs Access: {missingBindingLabels.join(", ")}.
        </div>
      ) : null}

      {feedback ? (
        <div
          className={cn("font-mono text-w-sm", feedback.ok ? "text-success" : "text-destructive")}
        >
          {feedback.message}
        </div>
      ) : null}

      {showConfig ? (
        <AssistantActionRow
          canPersist={canPersist}
          testing={testing}
          saving={saving}
          onTest={() => handleTest()}
          onSave={() => handleSave()}
        />
      ) : null}

      {showConfig ? (
        <AssistantConfigFields
          draft={draft}
          hasPreset={hasPreset}
          hasAuthHeaderBinding={hasAuthHeaderBinding}
          onDraftChange={(updater) => setDraft((prev) => (prev ? updater(prev) : prev))}
        />
      ) : null}
    </div>
  );
}
