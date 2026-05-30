"use client";

import type {
  McpSecretValue,
  McpServerConfig,
  McpTransportType,
} from "@radarboard/types/mcp-server";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import { Switch } from "@radarboard/ui/switch";
import { Textarea } from "@radarboard/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { CheckCircle2, ExternalLink, Loader2, Plus, Server, XCircle } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useState } from "react";
import { normalizeStdioCommand } from "@/lib/mcp/mcp-server-config";
import { handleExternalLinkClick } from "@/lib/system/ui/external-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormState {
  name: string;
  type: McpTransportType;
  url: string;
  authHeader: string;
  command: string;
  argsText: string;
  envText: string;
  cwd: string;
  docsUrl: string;
  enabled: boolean;
}

export type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok"; serverName?: string; serverVersion?: string; protocolVersion?: string }
  | { state: "error"; message: string };

export type PanelMode =
  | { type: "idle" }
  | { type: "creating" }
  | { type: "editing"; server: McpServerConfig };

export const EMPTY_FORM: FormState = {
  name: "",
  type: "streamable-http",
  url: "",
  authHeader: "",
  command: "",
  argsText: "",
  envText: "",
  cwd: "",
  docsUrl: "",
  enabled: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatArgsText(args?: string[]): string {
  return args?.join("\n") ?? "";
}

export function formatEnvText(env?: Record<string, McpSecretValue>): string {
  return Object.entries(env ?? {})
    .map(([key, value]) =>
      typeof value === "string"
        ? `${key}=${value}`
        : `${key}=[linked:${value.credentialKey}.${value.field}]`
    )
    .join("\n");
}

function parseArgsText(argsText: string): string[] {
  return argsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEnvText(envText: string): { env?: Record<string, string>; error?: string } {
  const env: Record<string, string> = {};

  for (const rawLine of envText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      return { error: 'Environment variables must use "KEY=VALUE" format.' };
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      return { error: 'Environment variables must use "KEY=VALUE" format.' };
    }

    env[key] = line.slice(separatorIndex + 1);
  }

  return Object.keys(env).length > 0 ? { env } : {};
}

export function buildTransportPayload(form: FormState):
  | {
      ok: true;
      value:
        | { type: "streamable-http"; url: string; authHeader?: string }
        | {
            type: "stdio";
            command: string;
            args?: string[];
            env?: Record<string, string>;
            cwd?: string;
          };
    }
  | { ok: false; error: string } {
  if (form.type === "stdio") {
    const normalized = normalizeStdioCommand(form.command, parseArgsText(form.argsText));
    if (!normalized.command) {
      return { ok: false, error: "Command is required for stdio MCP servers." };
    }

    const parsedEnv = parseEnvText(form.envText);
    if (parsedEnv.error) {
      return { ok: false, error: parsedEnv.error };
    }

    return {
      ok: true,
      value: {
        type: "stdio",
        command: normalized.command,
        args: normalized.args,
        env: parsedEnv.env,
        cwd: form.cwd.trim() || undefined,
      },
    };
  }

  const url = form.url.trim();
  if (!url) {
    return { ok: false, error: "URL is required for streamable HTTP MCP servers." };
  }

  return {
    ok: true,
    value: {
      type: "streamable-http",
      url,
      authHeader: form.authHeader.trim() || undefined,
    },
  };
}

export function buildServerPayload(
  form: FormState
): { ok: true; value: McpServerConfig } | { ok: false; error: string } {
  const name = form.name.trim().toLowerCase();
  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  const transport = buildTransportPayload(form);
  if (!transport.ok) return transport;

  return {
    ok: true,
    value:
      transport.value.type === "stdio"
        ? {
            name,
            type: "stdio",
            command: transport.value.command,
            args: transport.value.args,
            env: transport.value.env,
            cwd: transport.value.cwd,
            docsUrl: form.docsUrl.trim() || undefined,
            enabled: form.enabled,
          }
        : {
            name,
            type: "streamable-http",
            url: transport.value.url,
            authHeader: transport.value.authHeader,
            docsUrl: form.docsUrl.trim() || undefined,
            enabled: form.enabled,
          },
  };
}

export function buildConnectionTestPayload(server: McpServerConfig) {
  return server.type === "stdio"
    ? {
        type: "stdio" as const,
        command: server.command,
        args: server.args,
        env: server.env,
        cwd: server.cwd,
      }
    : {
        type: "streamable-http" as const,
        url: server.url,
        authHeader: server.authHeader,
      };
}

export function getFormInitialValues(panelMode: PanelMode): FormState {
  if (panelMode.type !== "editing") {
    return EMPTY_FORM;
  }

  const { server } = panelMode;
  if (server.type === "stdio") {
    return {
      name: server.name,
      type: "stdio",
      url: "",
      authHeader: "",
      command: server.command,
      argsText: formatArgsText(server.args),
      envText: formatEnvText(server.env),
      cwd: server.cwd ?? "",
      docsUrl: server.docsUrl ?? "",
      enabled: server.enabled,
    };
  }

  return {
    name: server.name,
    type: "streamable-http",
    url: server.url,
    authHeader: typeof server.authHeader === "string" ? server.authHeader : "",
    command: "",
    argsText: "",
    envText: "",
    cwd: "",
    docsUrl: server.docsUrl ?? "",
    enabled: server.enabled,
  };
}

function canTestConnection(form: FormState): boolean {
  return form.type === "stdio" ? form.command.trim().length > 0 : form.url.trim().length > 0;
}

function canSaveServer(form: FormState): boolean {
  return Boolean(
    form.name.trim() && (form.type === "stdio" ? form.command.trim() : form.url.trim())
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormField({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="mb-1.5 block font-mono text-dim text-xs uppercase tracking-wider"
      >
        {label}
        {Boolean(required) && <span className="ml-0.5 text-destructive">*</span>}
        {!required && (
          <span className="ml-1 text-dim/60 normal-case tracking-normal">(optional)</span>
        )}
      </Label>
      {children}
      {Boolean(hint) && (
        <p className="mt-1 whitespace-pre-wrap font-mono text-dim/60 text-xs">{hint}</p>
      )}
    </div>
  );
}

function ServerTransportFields({
  form,
  set,
}: {
  form: FormState;
  set: (key: keyof FormState, value: string | boolean) => void;
}) {
  if (form.type === "streamable-http") {
    return (
      <>
        <FormField
          id="mcp-url"
          label="URL"
          required
          hint="Streamable HTTP endpoint (http or https)."
        >
          <Input
            id="mcp-url"
            type="url"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="http://127.0.0.1:8089/mcp"
            className="h-9"
          />
        </FormField>

        <FormField
          id="mcp-auth"
          label="Auth Header"
          hint="Sent as the Authorization header. Leave blank for unauthenticated servers."
        >
          <Input
            id="mcp-auth"
            type="password"
            value={form.authHeader}
            onChange={(e) => set("authHeader", e.target.value)}
            placeholder="Bearer <token>"
            className="h-9"
          />
        </FormField>
      </>
    );
  }

  return (
    <>
      <FormField
        id="mcp-command"
        label="Command"
        required
        hint={
          'Executable to spawn. "npx" is the common case.\nYou can also paste a full command line here and Radarboard will split it automatically.'
        }
      >
        <Input
          id="mcp-command"
          type="text"
          value={form.command}
          onChange={(e) => set("command", e.target.value)}
          placeholder="npx"
          className="h-9"
        />
      </FormField>

      <FormField
        id="mcp-args"
        label="Arguments"
        hint={
          "One argument per line.\nIf you already pasted the full command above, you can leave this blank.\nExample:\n-y\nopenpanel-mcp-server"
        }
      >
        <Textarea
          id="mcp-args"
          value={form.argsText}
          onChange={(e) => set("argsText", e.target.value)}
          placeholder={"-y\nopenpanel-mcp-server"}
          className="min-h-[96px]"
        />
      </FormField>

      <FormField
        id="mcp-cwd"
        label="Working Directory"
        hint="Optional current working directory for the MCP process."
      >
        <Input
          id="mcp-cwd"
          type="text"
          value={form.cwd}
          onChange={(e) => set("cwd", e.target.value)}
          placeholder="/Users/thedaviddias/Projects/radarboard"
          className="h-9"
        />
      </FormField>

      <FormField
        id="mcp-env"
        label="Environment Variables"
        hint={
          "One entry per line using KEY=VALUE.\nThese values are passed directly to the MCP server process.\nExample:\nOPENPANEL_CLIENT_ID=site-id\nOPENPANEL_CLIENT_SECRET=site-secret"
        }
      >
        <Textarea
          id="mcp-env"
          value={form.envText}
          onChange={(e) => set("envText", e.target.value)}
          placeholder={"OPENPANEL_CLIENT_ID=site-id\nOPENPANEL_CLIENT_SECRET=site-secret"}
          className="min-h-[112px]"
        />
      </FormField>
    </>
  );
}

function TestStatusBanner({ testStatus }: { testStatus: TestStatus }) {
  if (testStatus.state === "idle") return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-item border p-3 font-mono text-w-sm",
        (() => {
          if (testStatus.state === "ok") return "border-success/30 bg-success/10 text-success";
          if (testStatus.state === "error")
            return "border-destructive/30 bg-destructive/10 text-destructive";
          return "border-border bg-surface text-dim";
        })()
      )}
    >
      {testStatus.state === "testing" && (
        <Loader2 className="icon-xs mt-0.5 shrink-0 animate-spin" />
      )}
      {testStatus.state === "ok" && <CheckCircle2 className="icon-xs mt-0.5 shrink-0" />}
      {testStatus.state === "error" && <XCircle className="icon-xs mt-0.5 shrink-0" />}
      <div className="whitespace-pre-wrap break-words">
        {testStatus.state === "testing" && "Connecting…"}
        {testStatus.state === "ok" && (
          <>
            <div>Connected successfully</div>
            {Boolean(
              testStatus.serverName || testStatus.serverVersion || testStatus.protocolVersion
            ) && (
              <div className="mt-0.5 text-success/80 text-xs">
                {[testStatus.serverName, testStatus.serverVersion, testStatus.protocolVersion]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </>
        )}
        {testStatus.state === "error" && testStatus.message}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ServerForm
// ---------------------------------------------------------------------------

interface ServerFormProps {
  initialValues: FormState;
  isEditing: boolean;
  onSave: (form: FormState) => Promise<void>;
  onCancel: () => void;
  onTest: (form: FormState) => Promise<void>;
  testStatus: TestStatus;
  saving: boolean;
  saveError: string | null;
}

export function ServerForm({
  initialValues,
  isEditing,
  onSave,
  onCancel,
  onTest,
  testStatus,
  saving,
  saveError,
}: ServerFormProps) {
  const [form, setForm] = useState<FormState>(() => initialValues);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setTransport = useCallback((type: McpTransportType) => {
    setForm((prev) => ({
      ...prev,
      type,
      command: type === "stdio" && !prev.command.trim() ? "npx" : prev.command,
    }));
  }, []);

  const handleTest = useCallback(async () => {
    await onTest(form);
  }, [form, onTest]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await onSave(form);
    },
    [form, onSave]
  );

  const isNameLocked = isEditing;
  const canTest = canTestConnection(form);
  const canSave = canSaveServer(form);
  const submitLabel = isEditing ? "Save Changes" : "Add Server";

  return (
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-border border-b px-4 py-3">
        <h3 className="font-mono text-dim text-w-sm uppercase tracking-wider">
          {isEditing ? `Edit "${initialValues.name}"` : "New MCP Server"}
        </h3>
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
        <div className="flex items-center justify-between border-border border-b pb-3">
          <div>
            <div className="font-mono text-foreground text-w-base">Enabled</div>
            <div className="font-mono text-dim text-xs">
              Disabled servers are stored but not used.
            </div>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) => set("enabled", checked)}
            aria-label="Toggle MCP server"
          />
        </div>

        {testStatus.state !== "idle" && <TestStatusBanner testStatus={testStatus} />}

        {Boolean(saveError) && (
          <div className="flex items-center gap-2 rounded-item border border-destructive/30 bg-destructive/10 p-3 font-mono text-destructive text-w-sm">
            <XCircle className="icon-xs shrink-0" />
            <span className="whitespace-pre-wrap break-words">{saveError}</span>
          </div>
        )}

        <FormField
          id="mcp-transport"
          label="Transport"
          required
          hint='Use a remote MCP URL or launch a local command such as "npx".'
        >
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={form.type === "streamable-http" ? "default" : "outline"}
              onClick={() => setTransport("streamable-http")}
              className={cn(
                "uppercase-none flex h-auto flex-col items-start gap-1 p-3 text-left font-normal",
                form.type === "streamable-http"
                  ? "border-accent/30 bg-accent/20 text-accent"
                  : "text-dim"
              )}
            >
              <div className="font-mono text-w-base">streamable-http</div>
              <div className="font-mono text-xs opacity-80">Remote HTTP endpoint</div>
            </Button>
            <Button
              type="button"
              variant={form.type === "stdio" ? "default" : "outline"}
              onClick={() => setTransport("stdio")}
              className={cn(
                "uppercase-none flex h-auto flex-col items-start gap-1 p-3 text-left font-normal",
                form.type === "stdio" ? "border-accent/30 bg-accent/20 text-accent" : "text-dim"
              )}
            >
              <div className="font-mono text-w-base">stdio</div>
              <div className="font-mono text-xs opacity-80">Local command, typically `npx`</div>
            </Button>
          </div>
        </FormField>

        <FormField
          id="mcp-name"
          label="Name"
          required
          hint={`Lowercase letters, numbers, hyphens, underscores.${isNameLocked ? " Cannot be changed after creation." : ""}`}
        >
          <Input
            id="mcp-name"
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={isNameLocked}
            placeholder="astro"
            className="h-9"
          />
        </FormField>

        <ServerTransportFields form={form} set={set} />

        <FormField
          id="mcp-docs"
          label="Documentation URL"
          hint="Link to the server's documentation or homepage."
        >
          <div className="relative">
            <Input
              id="mcp-docs"
              type="url"
              value={form.docsUrl}
              onChange={(e) => set("docsUrl", e.target.value)}
              placeholder="https://docs.example.com/mcp"
              className={cn("h-9", form.docsUrl && "pr-8")}
            />
            {Boolean(form.docsUrl) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={form.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => handleExternalLinkClick(event, form.docsUrl)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-dim transition-colors hover:text-accent"
                    tabIndex={-1}
                  >
                    <ExternalLink className="icon-xs" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Open documentation</TooltipContent>
              </Tooltip>
            )}
          </div>
        </FormField>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-border border-t px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!canTest || testStatus.state === "testing" || saving}
          uppercase={false}
        >
          {testStatus.state === "testing" ? (
            <>
              <Loader2 className="icon-xs mr-1.5 animate-spin" />
              Testing…
            </>
          ) : (
            "Test Connection"
          )}
        </Button>

        <div className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
          uppercase={false}
        >
          Cancel
        </Button>

        <Button type="submit" size="sm" disabled={saving || !canSave} uppercase={false}>
          {saving ? (
            <>
              <Loader2 className="icon-xs mr-1.5 animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <Server className="h-8 w-8 text-secondary" />
      <div>
        <p className="font-mono text-dim text-w-base">No MCP servers configured</p>
        <p className="mt-1 font-mono text-dim/60 text-xs">
          Add a server to connect to external MCP tools
        </p>
      </div>
      <Button size="sm" onClick={onAdd} uppercase={false}>
        <Plus className="icon-xs mr-1.5" />
        Add Server
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ServerDetailPanel
// ---------------------------------------------------------------------------

interface ServerDetailPanelProps {
  panelMode: PanelMode;
  formInitialValues: FormState;
  onSave: (form: FormState) => Promise<void>;
  onCancel: () => void;
  onTest: (form: FormState) => Promise<void>;
  testStatus: TestStatus;
  saving: boolean;
  saveError: string | null;
  onAddNew: () => void;
}

export function ServerDetailPanel({
  panelMode,
  formInitialValues,
  onSave,
  onCancel,
  onTest,
  testStatus,
  saving,
  saveError,
  onAddNew,
}: ServerDetailPanelProps) {
  const showForm = panelMode.type === "creating" || panelMode.type === "editing";

  return (
    <div className="min-w-0 flex-1">
      {showForm ? (
        <ServerForm
          key={panelMode.type === "editing" ? panelMode.server.name : "new"}
          initialValues={formInitialValues}
          isEditing={panelMode.type === "editing"}
          onSave={onSave}
          onCancel={onCancel}
          onTest={onTest}
          testStatus={testStatus}
          saving={saving}
          saveError={saveError}
        />
      ) : (
        <EmptyState onAdd={onAddNew} />
      )}
    </div>
  );
}
