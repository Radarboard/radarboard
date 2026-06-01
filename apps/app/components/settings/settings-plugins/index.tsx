"use client";

import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import type {
  PluginConnectionType,
  PluginDataSource,
  PluginDescriptor,
  PluginSettingDefinition,
  PluginUserConfig,
} from "@radarboard/plugin-sdk/types";
import {
  isPluginNotificationIntegrationEnabled,
  isPluginTickerIntegrationEnabled,
  pluginSupportsNotifications,
  pluginSupportsTicker,
  resolvePresentationConfig,
} from "@radarboard/plugin-sdk/types";
import { API_ROUTES, pluginDataRoute } from "@radarboard/types/api-routes";
import { POLLING_SOURCE_REGISTRY } from "@radarboard/types/polling";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogSizeToggle,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSearch,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { Switch } from "@radarboard/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radarboard/ui/tabs";
import { cn } from "@radarboard/utils/cn";
import { Check, ChevronDown, ExternalLink, Eye, EyeOff, Loader2, X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDisabledPluginsState } from "@/hooks/plugins/use-disabled-plugins";
import { usePluginConfigState } from "@/hooks/plugins/use-plugin-configs";
import { ShortcutKeys } from "../../shortcuts/shortcut-keys";
import { CommunityExtensionDiscovery } from "../community-discovery";
import { InstallExtensionDialog } from "../extension-installer";
import { PollingSourceControls } from "../polling-controls";
import { SettingsCatalogCard } from "../settings-catalog-card";
import { SettingsGrid, SettingsPageLayout, SettingsPageToolbar } from "../settings-page-layout";
import type { SettingsSection } from "../settings-sections";

// ---------------------------------------------------------------------------
// Settings field renderer
// ---------------------------------------------------------------------------

function SettingField({
  def,
  value,
  onChange,
}: {
  def: PluginSettingDefinition;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-item border border-border bg-surface p-3">
      <div className="min-w-0">
        <div className="font-medium font-mono text-foreground text-w-base">{def.label}</div>
        {Boolean(def.description) && (
          <div className="text-muted-foreground text-w-sm">{def.description}</div>
        )}
      </div>

      {def.type === "boolean" && (
        <Switch checked={value as boolean} onCheckedChange={(checked) => onChange(checked)} />
      )}
      {def.type === "select" && (
        <Select value={String(value)} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8 min-w-[120px] font-mono text-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {def.searchable && <SelectSearch />}
            {def.optionGroups
              ? def.optionGroups.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectGroupLabel>{group.label}</SelectGroupLabel>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))
              : def.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      )}
      {def.type === "number" && (
        <Input
          type="number"
          value={value as number}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 w-20 text-right font-mono text-w-sm"
        />
      )}
      {def.type !== "boolean" && def.type !== "select" && def.type !== "number" && (
        <Input
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Not set"
          className="h-8 min-w-[140px] font-mono text-w-sm"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin Card
// ---------------------------------------------------------------------------

function PluginCard({
  plugin,
  enabled,
  onToggle,
  onClick,
}: {
  plugin: PluginDescriptor;
  enabled: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  const Icon = plugin.icon;
  const toolCount = plugin.mcpTools?.length ?? 0;
  const widgetCount = plugin.widgets?.length ?? 0;

  return (
    <SettingsCatalogCard
      enabled={enabled}
      title={plugin.name}
      titleMeta={`v${plugin.version}`}
      description={plugin.description}
      onOpen={onClick}
      openAriaLabel={`Configure ${plugin.name}`}
      checked={enabled}
      onCheckedChange={onToggle}
      switchAriaLabel={enabled ? `Disable ${plugin.name}` : `Enable ${plugin.name}`}
      icon={
        <div
          className={cn(
            "icon-sm inline-flex items-center justify-center rounded-item border border-border",
            enabled ? "bg-secondary text-foreground-secondary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="icon-xs" />
        </div>
      }
      badges={
        <>
          <Badge variant="secondary">dock when enabled</Badge>
          {widgetCount > 0 && (
            <Badge variant="secondary">
              {widgetCount} widget{widgetCount > 1 ? "s" : ""}
            </Badge>
          )}
          {toolCount > 0 && (
            <Badge variant="secondary">
              {toolCount} MCP tool{toolCount > 1 ? "s" : ""}
            </Badge>
          )}
          {Boolean(plugin.shortcut) && (
            <Badge variant="secondary">
              <ShortcutKeys shortcut={plugin.shortcut!} />
            </Badge>
          )}
          <Badge variant="secondary">{resolvePresentationConfig(plugin).default}</Badge>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Section header for the modal
// ---------------------------------------------------------------------------

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="font-medium font-mono text-foreground text-w-base">
      {title}
      {count !== undefined && <span className="ml-1 text-dim">({count})</span>}
    </div>
  );
}

function getPluginPollingSourceIds(plugin: PluginDescriptor): string[] {
  return Array.from(
    new Set(
      Array.from(POLLING_SOURCE_REGISTRY.entries())
        .filter(([sourceId, definition]) => {
          if (sourceId === `plugin-${plugin.id}` || sourceId === `plugin-dock-${plugin.id}`) {
            return true;
          }

          return definition.widgetIds.some((widgetId) => widgetId.startsWith(`${plugin.id}__`));
        })
        .map(([sourceId]) => sourceId)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function CollapsibleSection({
  title,
  count,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => defaultOpen);
  return (
    <div className="rounded-item border border-border bg-surface p-3">
      <Button
        type="button"
        variant="ghost"
        spacing="none"
        uppercase={false}
        rounded="none"
        fullWidth
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between text-left hover:bg-transparent"
      >
        <SectionHeader title={title} count={count} />
        <ChevronDown
          className={cn("icon-sm text-dim transition-transform", !open && "-rotate-90")}
        />
      </Button>
      {Boolean(description) && (
        <div className="mt-1 mb-2 text-muted-foreground text-w-sm">{description}</div>
      )}
      {Boolean(open) && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function RadarboardIntegrationCard({
  plugin,
  config,
  updateConfig,
}: {
  plugin: PluginDescriptor;
  config: PluginUserConfig;
  updateConfig: (updater: (prev: PluginUserConfig) => PluginUserConfig) => void;
}) {
  const supportsNotifications = pluginSupportsNotifications(plugin);
  const supportsTicker = pluginSupportsTicker(plugin);

  if (!supportsNotifications && !supportsTicker) return null;

  return (
    <div className="space-y-3 rounded-item border border-border bg-surface p-3">
      <SectionHeader title="Radarboard Integrations" />
      <div className="text-muted-foreground text-w-sm">
        Control whether this plugin contributes to shared Radarboard surfaces.
      </div>

      {supportsNotifications && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium font-mono text-foreground text-w-base">Notifications</div>
            <div className="text-muted-foreground text-w-sm">
              Allow this plugin to publish into the Radarboard notification pipeline.
            </div>
          </div>
          <Switch
            checked={isPluginNotificationIntegrationEnabled(plugin, config)}
            onCheckedChange={(checked) =>
              updateConfig((prev) => ({
                ...prev,
                notificationIntegrationEnabled: checked,
              }))
            }
            aria-label={`${plugin.name} notifications`}
          />
        </div>
      )}

      {supportsTicker && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium font-mono text-foreground text-w-base">Bottom Ticker</div>
            <div className="text-muted-foreground text-w-sm">
              Allow this plugin to surface alerts or activity in the shared ticker.
            </div>
          </div>
          <Switch
            checked={isPluginTickerIntegrationEnabled(plugin, config)}
            onCheckedChange={(checked) =>
              updateConfig((prev) => ({
                ...prev,
                tickerIntegrationEnabled: checked,
              }))
            }
            aria-label={`${plugin.name} ticker`}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Source helpers
// ---------------------------------------------------------------------------

async function fetchConnectionStatus(
  pluginId: string,
  ds: PluginDataSource
): Promise<{ connected: boolean; type: PluginConnectionType | null }> {
  const token = await getPluginToken(pluginId);
  for (const ct of ds.connectionTypes) {
    const key = ct === "mcp" ? `ds:${ds.id}:mcp` : `ds:${ds.id}:cred:${ds.integrationKey ?? ds.id}`;
    try {
      const res = await fetch(pluginDataRoute(pluginId, key), {
        headers: { "X-Plugin-Token": token },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.value) return { connected: true, type: ct };
      }
    } catch {
      /* skip */
    }
  }
  return { connected: false, type: null };
}

async function saveApiKey(pluginId: string, ds: PluginDataSource, value: string): Promise<void> {
  const token = await getPluginToken(pluginId);
  const key = `ds:${ds.id}:cred:${ds.integrationKey ?? ds.id}`;
  await fetch(API_ROUTES.pluginData, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Plugin-Token": token,
    },
    body: JSON.stringify({ pluginId, key, value: JSON.stringify(value) }),
  });
}

async function clearConnection(
  pluginId: string,
  ds: PluginDataSource,
  ct: PluginConnectionType
): Promise<void> {
  const token = await getPluginToken(pluginId);
  const key = ct === "mcp" ? `ds:${ds.id}:mcp` : `ds:${ds.id}:cred:${ds.integrationKey ?? ds.id}`;
  await fetch(API_ROUTES.pluginData, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Plugin-Token": token,
    },
    body: JSON.stringify({ pluginId, key }),
  });
}

// ---------------------------------------------------------------------------
// ConnectionTypeControl — renders UI for a single connection type
// ---------------------------------------------------------------------------

function McpConnectionControl({
  ds,
  onOpenSettings,
}: {
  ds: PluginDataSource;
  onOpenSettings: (section: SettingsSection) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground text-w-sm">
        MCP{ds.mcpServerNames?.length ? `: ${ds.mcpServerNames.join(", ")}` : ""}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onOpenSettings("mcp-servers")}
        className="uppercase-none flex h-auto items-center gap-1 p-0 font-mono text-accent text-w-sm transition-colors hover:bg-transparent hover:text-accent"
      >
        Configure in MCP Settings
        <ExternalLink className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}

function ApiKeyConnectionControl({
  apiKeyValue,
  setApiKeyValue,
  showKey,
  setShowKey,
  saving,
  onSave,
}: {
  apiKeyValue: string;
  setApiKeyValue: (v: string) => void;
  showKey: boolean;
  setShowKey: (fn: (v: boolean) => boolean) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-w-sm">API Key</div>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
            placeholder="Enter API key..."
            className="h-7 pr-7 font-mono text-w-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowKey((v) => !v)}
            className="icon-base uppercase-none absolute top-1/2 right-1 -translate-y-1/2 text-dim hover:bg-transparent hover:text-foreground-secondary"
          >
            {showKey ? <EyeOff className="icon-xs" /> : <Eye className="icon-xs" />}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!apiKeyValue.trim() || saving}
          className="uppercase-none h-7 px-2 font-mono text-w-sm"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataSourceCard — per-source connection UI
// ---------------------------------------------------------------------------

function DataSourceCard({
  pluginId,
  ds,
  onOpenSettings,
}: {
  pluginId: string;
  ds: PluginDataSource;
  onOpenSettings: (section: SettingsSection) => void;
}) {
  const [status, setStatus] = useState<{
    loading: boolean;
    connected: boolean;
    type: PluginConnectionType | null;
  }>({ loading: true, connected: false, type: null });
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const refreshStatus = useCallback(() => {
    setStatus((prev) => ({ ...prev, loading: true }));
    fetchConnectionStatus(pluginId, ds)
      .then((result) => {
        setStatus({ loading: false, ...result });
      })
      .catch(() => {
        /* fire-and-forget */
      });
  }, [pluginId, ds]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKeyValue.trim()) return;
    setSaving(true);
    await saveApiKey(pluginId, ds, apiKeyValue.trim());
    setApiKeyValue("");
    setSaving(false);
    refreshStatus();
  }, [pluginId, ds, apiKeyValue, refreshStatus]);

  const handleDisconnect = useCallback(async () => {
    if (!status.type) return;
    await clearConnection(pluginId, ds, status.type);
    refreshStatus();
  }, [pluginId, ds, status.type, refreshStatus]);

  const getStatusBadge = () => {
    if (status.loading) {
      return (
        <span className="flex items-center gap-1 rounded-item bg-secondary px-1.5 py-0.5 font-mono text-dim text-w-sm">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Checking
        </span>
      );
    }
    if (status.connected) {
      return (
        <span className="flex items-center gap-1 rounded-item bg-emerald-400/10 px-1.5 py-0.5 font-mono text-emerald-400 text-w-sm">
          <Check className="h-2.5 w-2.5" />
          Connected via {status.type?.toUpperCase()}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 rounded-item bg-secondary px-1.5 py-0.5 font-mono text-dim text-w-sm">
        <X className="h-2.5 w-2.5" />
        Not connected
      </span>
    );
  };
  const statusBadge = getStatusBadge();

  return (
    <div className="rounded-item border border-border bg-background/50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium font-mono text-foreground-secondary text-w-sm">{ds.name}</span>
        <div className="flex items-center gap-2">
          {ds.required && !status.connected && !status.loading && (
            <span className="rounded-item bg-warning/10 px-1.5 py-0.5 font-mono text-w-sm text-warning">
              Required
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      <div className="mb-2 text-muted-foreground text-w-sm">{ds.description}</div>

      {/* Connection controls per type */}
      {status.connected ? (
        <Button
          type="button"
          variant="ghost"
          onClick={handleDisconnect}
          className="uppercase-none h-auto p-0 font-mono text-destructive text-w-sm transition-colors hover:bg-transparent hover:text-destructive"
        >
          Disconnect
        </Button>
      ) : (
        <div className="space-y-2">
          {ds.connectionTypes.map((ct) => {
            if (ct === "mcp") {
              return <McpConnectionControl key={ct} ds={ds} onOpenSettings={onOpenSettings} />;
            }
            if (ct === "api_key") {
              return (
                <ApiKeyConnectionControl
                  key={ct}
                  apiKeyValue={apiKeyValue}
                  setApiKeyValue={setApiKeyValue}
                  showKey={showKey}
                  setShowKey={setShowKey}
                  saving={saving}
                  onSave={handleSaveApiKey}
                />
              );
            }
            if (ct === "oauth") {
              return (
                <div key={ct} className="flex items-center justify-between">
                  <div className="text-muted-foreground text-w-sm">OAuth</div>
                  <span className="font-mono text-dim text-w-sm">Coming soon</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin Detail Modal — fully editable
// ---------------------------------------------------------------------------

function PluginExtensionsTab({
  plugin,
  disabledWidgets,
  disabledTools,
  updateConfig,
}: {
  plugin: PluginDescriptor;
  disabledWidgets: Set<string>;
  disabledTools: Set<string>;
  updateConfig: (updater: (prev: PluginUserConfig) => PluginUserConfig) => void;
}) {
  return (
    <TabsContent value="extensions" className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-4">
      <div className="space-y-5">
        {(plugin.widgets?.length ?? 0) > 0 && (
          <CollapsibleSection
            title="Widgets"
            count={plugin.widgets?.length}
            description="Toggle individual dashboard widgets"
          >
            {plugin.widgets?.map((w) => {
              const wEnabled = !disabledWidgets.has(w.widgetId);
              return (
                <div key={w.widgetId} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="font-mono text-foreground-secondary text-w-sm">{w.name}</span>
                    <span className="ml-2 font-mono text-dim text-w-sm">
                      {plugin.id}__{w.widgetId}
                    </span>
                  </div>
                  <Switch
                    checked={wEnabled}
                    onCheckedChange={(checked) => {
                      updateConfig((prev) => {
                        const set = new Set(prev.disabledWidgets ?? []);
                        if (checked) set.delete(w.widgetId);
                        else set.add(w.widgetId);
                        return {
                          ...prev,
                          disabledWidgets: set.size > 0 ? Array.from(set) : undefined,
                        };
                      });
                    }}
                  />
                </div>
              );
            })}
          </CollapsibleSection>
        )}

        {(plugin.mcpTools?.length ?? 0) > 0 && (
          <CollapsibleSection
            title="MCP Tools"
            count={plugin.mcpTools?.length}
            description="Toggle individual tools exposed to AI assistants"
            defaultOpen={false}
          >
            {plugin.mcpTools?.map((tool) => {
              const tEnabled = !disabledTools.has(tool.name);
              return (
                <div key={tool.name} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-foreground-secondary text-w-sm">
                      {plugin.id}__{tool.name}
                    </span>
                    <div className="truncate text-dim text-w-sm">{tool.description}</div>
                  </div>
                  <Switch
                    checked={tEnabled}
                    onCheckedChange={(checked) => {
                      updateConfig((prev) => {
                        const set = new Set(prev.disabledTools ?? []);
                        if (checked) set.delete(tool.name);
                        else set.add(tool.name);
                        return {
                          ...prev,
                          disabledTools: set.size > 0 ? Array.from(set) : undefined,
                        };
                      });
                    }}
                  />
                </div>
              );
            })}
          </CollapsibleSection>
        )}
      </div>
    </TabsContent>
  );
}

function PluginGeneralTab({
  plugin,
  config,
  currentShortcut,
  configurableSurfaces,
  onOpenSettings,
  updateConfig,
}: {
  plugin: PluginDescriptor;
  config: PluginUserConfig;
  currentShortcut: string;
  configurableSurfaces: string[];
  onOpenSettings: (section: SettingsSection) => void;
  updateConfig: (updater: (prev: PluginUserConfig) => PluginUserConfig) => void;
}) {
  return (
    <TabsContent value="general" className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-4">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-item border border-border bg-surface p-3">
          <div>
            <div className="font-medium font-mono text-foreground text-w-base">Shortcut</div>
            <div className="text-muted-foreground text-w-sm">
              Managed from the unified Shortcuts page
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentShortcut ? (
              <Badge className="bg-secondary text-dim">
                <ShortcutKeys shortcut={currentShortcut} />
              </Badge>
            ) : (
              <Badge className="bg-secondary text-dim">Unassigned</Badge>
            )}
            <Button
              type="button"
              variant="outline"
              uppercase={false}
              onClick={() => onOpenSettings("shortcuts")}
              className="h-8 rounded-none px-3 font-mono text-w-sm"
            >
              Open Shortcuts
            </Button>
          </div>
        </div>

        <div className="rounded-item border border-border bg-surface p-3">
          <SectionHeader title="Launch Surfaces" />
          <div className="mb-2 text-muted-foreground text-w-sm">
            Enabled plugins always appear in the left dock. These overrides are kept for non-dock
            launch entry points.
          </div>
          <div className="flex gap-3">
            {CONFIGURABLE_LAUNCH_SURFACES.map((surface) => {
              const active = configurableSurfaces.includes(surface);
              return (
                <div key={surface} className="flex cursor-pointer items-center gap-1.5">
                  <Switch
                    id={`surface-${surface}`}
                    checked={active}
                    onCheckedChange={(checked) => {
                      updateConfig((prev) => {
                        const base = prev.launchSurfaces ?? [...plugin.launchSurfaces];
                        const preservedDock: NonNullable<PluginUserConfig["launchSurfaces"]> =
                          base.includes("dock") ? ["dock"] : [];
                        const current = base.filter((value) => value !== "dock");
                        const next = checked
                          ? [...new Set([...current, surface])]
                          : current.filter((value) => value !== surface);
                        return { ...prev, launchSurfaces: [...preservedDock, ...next] };
                      });
                    }}
                    aria-label={`Show in ${surface}`}
                  />
                  <span className="font-mono text-foreground-secondary text-w-sm capitalize">
                    {surface}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <RadarboardIntegrationCard plugin={plugin} config={config} updateConfig={updateConfig} />
      </div>
    </TabsContent>
  );
}

function PluginConfigurationTab({
  plugin,
  config,
  pollingSourceIds,
  updateConfig,
  onOpenSettings,
}: {
  plugin: PluginDescriptor;
  config: PluginUserConfig;
  pollingSourceIds: string[];
  updateConfig: (updater: (prev: PluginUserConfig) => PluginUserConfig) => void;
  onOpenSettings: (section: SettingsSection) => void;
}) {
  return (
    <TabsContent value="configuration" className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-4">
      <div className="space-y-5">
        <PollingSourceControls
          sourceIds={pollingSourceIds}
          description="Control how often Radarboard refreshes this plugin's widgets and related surfaces."
        />

        {(plugin.dataSources?.length ?? 0) > 0 && (
          <CollapsibleSection
            title="Data Sources"
            count={plugin.dataSources?.length}
            description="External services this plugin can connect to"
          >
            {plugin.dataSources?.map((ds) => (
              <DataSourceCard
                key={ds.id}
                pluginId={plugin.id}
                ds={ds}
                onOpenSettings={onOpenSettings}
              />
            ))}
          </CollapsibleSection>
        )}

        {(plugin.settings?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <SectionHeader title="Settings" count={plugin.settings?.length} />
            <div className="grid grid-cols-2 gap-2">
              {plugin.settings?.map((def) => {
                const val = config.settings?.[def.key] ?? def.defaultValue;
                return (
                  <SettingField
                    key={def.key}
                    def={def}
                    value={val}
                    onChange={(newVal) => {
                      updateConfig((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, [def.key]: newVal },
                      }));
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </TabsContent>
  );
}

const CONFIGURABLE_LAUNCH_SURFACES = ["palette", "topbar"] as const;

function PluginDetailModalBody({
  plugin,
  enabled,
  onToggle,
  isLoading,
  config,
  updateConfig,
  currentShortcut,
  configurableSurfaces,
  disabledWidgets,
  disabledTools,
  pluginPollingSourceIds,
  hasExtensions,
  hasConfiguration,
  activeTab,
  setActiveTab,
  onOpenSettings,
}: {
  plugin: PluginDescriptor;
  enabled: boolean;
  onToggle: () => void;
  isLoading: boolean;
  config: PluginUserConfig;
  updateConfig: (updater: (prev: PluginUserConfig) => PluginUserConfig) => void;
  currentShortcut: string;
  configurableSurfaces: string[];
  disabledWidgets: Set<string>;
  disabledTools: Set<string>;
  pluginPollingSourceIds: string[];
  hasExtensions: boolean;
  hasConfiguration: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSettings: (section: SettingsSection) => void;
}) {
  return (
    <DialogBody className="flex min-h-0 flex-1 flex-col p-0">
      <div className="space-y-4 px-4 pt-1">
        <p className="text-dim text-w-sm leading-relaxed">{plugin.description}</p>
        {isLoading ? (
          <EmptyState message="Loading configuration..." />
        ) : (
          <div className="flex items-center justify-between rounded-item border border-border bg-surface p-3">
            <div>
              <div className="font-medium font-mono text-foreground text-w-base">Enabled</div>
              <div className="text-muted-foreground text-w-sm">
                {enabled ? "Active and available" : "Hidden from dashboard"}
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              aria-label={enabled ? `Disable ${plugin.name}` : `Enable ${plugin.name}`}
            />
          </div>
        )}
      </div>
      {!isLoading && (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-3 flex min-h-0 flex-1 flex-col"
        >
          <div className="px-4">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              {Boolean(hasExtensions) && <TabsTrigger value="extensions">Extensions</TabsTrigger>}
              {Boolean(hasConfiguration) && (
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
              )}
            </TabsList>
          </div>
          <PluginGeneralTab
            plugin={plugin}
            config={config}
            currentShortcut={currentShortcut}
            configurableSurfaces={configurableSurfaces}
            onOpenSettings={onOpenSettings}
            updateConfig={updateConfig}
          />
          {Boolean(hasExtensions) && (
            <PluginExtensionsTab
              plugin={plugin}
              disabledWidgets={disabledWidgets}
              disabledTools={disabledTools}
              updateConfig={updateConfig}
            />
          )}
          {Boolean(hasConfiguration) && (
            <PluginConfigurationTab
              plugin={plugin}
              config={config}
              pollingSourceIds={pluginPollingSourceIds}
              updateConfig={updateConfig}
              onOpenSettings={onOpenSettings}
            />
          )}
        </Tabs>
      )}
    </DialogBody>
  );
}

function PluginDetailModal({
  plugin,
  open,
  onOpenChange,
  enabled,
  onToggle,
  onOpenSettings,
}: {
  plugin: PluginDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  onToggle: () => void;
  onOpenSettings: (section: SettingsSection) => void;
}) {
  const Icon = plugin.icon;
  const { config, isLoading, updateConfig } = usePluginConfigState(plugin.id);

  // Resolved values (config overrides or descriptor defaults)
  const currentShortcut = config.shortcut ?? plugin.shortcut ?? "";
  const currentSurfaces = config.launchSurfaces ?? plugin.launchSurfaces;
  const configurableSurfaces = currentSurfaces.filter((surface) => surface !== "dock");
  const disabledTools = new Set(config.disabledTools ?? []);
  const disabledWidgets = new Set(config.disabledWidgets ?? []);
  const pluginPollingSourceIds = getPluginPollingSourceIds(plugin);

  const hasExtensions = (plugin.widgets?.length ?? 0) > 0 || (plugin.mcpTools?.length ?? 0) > 0;
  const hasConfiguration =
    pluginPollingSourceIds.length > 0 ||
    (plugin.dataSources?.length ?? 0) > 0 ||
    (plugin.settings?.length ?? 0) > 0;

  const [activeTabParam, setActiveTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsPluginTab,
    parseAsString
  );
  const [modalSize, setModalSize] = useState<"sm" | "md" | "lg">("sm");
  const validTabs = useMemo(
    () => [
      "general",
      ...(hasExtensions ? ["extensions"] : []),
      ...(hasConfiguration ? ["configuration"] : []),
    ],
    [hasConfiguration, hasExtensions]
  );
  const activeTab = validTabs.includes(activeTabParam ?? "") ? activeTabParam! : "general";

  useEffect(() => {
    if (!open) {
      if (activeTabParam !== null) {
        setActiveTabParam(null);
      }
      return;
    }
    if (activeTabParam === activeTab) return;
    setActiveTabParam(activeTab);
  }, [activeTab, activeTabParam, open, setActiveTabParam]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={modalSize} className="flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-card bg-secondary">
              <Icon className="icon-xs text-foreground-secondary" />
            </div>
            <span className="flex-1 font-mono">{plugin.name}</span>
            <span className="font-mono text-dim text-w-sm">v{plugin.version}</span>
            <DialogSizeToggle
              size={modalSize}
              onSizeChange={setModalSize}
              className="ml-2"
              ariaLabel="Plugin details size"
            />
          </DialogTitle>
          <DialogDescription className="sr-only">
            Plugin details and configuration
          </DialogDescription>
        </DialogHeader>

        <PluginDetailModalBody
          plugin={plugin}
          enabled={enabled}
          onToggle={onToggle}
          isLoading={isLoading}
          config={config}
          updateConfig={updateConfig}
          currentShortcut={currentShortcut}
          configurableSurfaces={configurableSurfaces}
          disabledWidgets={disabledWidgets}
          disabledTools={disabledTools}
          pluginPollingSourceIds={pluginPollingSourceIds}
          hasExtensions={hasExtensions}
          hasConfiguration={hasConfiguration}
          activeTab={activeTab}
          setActiveTab={setActiveTabParam}
          onOpenSettings={onOpenSettings}
        />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SettingsPlugins({
  onOpenSettings,
}: {
  onOpenSettings: (section: SettingsSection) => void;
}) {
  const plugins = useMemo(() => getAllPlugins(), []);
  const { disabledIds, setPluginEnabled } = useDisabledPluginsState();
  const [searchQuery, setSearchQuery] = useState("");
  const [activePluginId, setActivePluginId] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsPlugin,
    parseAsString
  );
  const [, setSettingsPluginTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsPluginTab,
    parseAsString
  );
  const [settingsInstallerParam, setSettingsInstallerParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsInstaller,
    parseAsString
  );
  const [installerGithubUrl, setInstallerGithubUrl] = useState("");
  const installerOpen = settingsInstallerParam === "plugins";

  const enabledCount = plugins.length - disabledIds.size;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return plugins;
    const q = searchQuery.toLowerCase();
    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [plugins, searchQuery]);

  const handleToggle = useCallback(
    (pluginId: string) => {
      setPluginEnabled(pluginId, disabledIds.has(pluginId));
    },
    [disabledIds, setPluginEnabled]
  );

  const activePlugin = activePluginId
    ? (plugins.find((p) => p.id === activePluginId) ?? null)
    : null;

  useEffect(() => {
    if (activePluginId !== null && activePlugin === null) {
      setActivePluginId(null);
      setSettingsPluginTabParam(null);
    }
  }, [activePlugin, activePluginId, setActivePluginId, setSettingsPluginTabParam]);

  const getStatusColor = () => {
    if (enabledCount === plugins.length) return "green" as const;
    if (enabledCount > 0) return "yellow" as const;
    return "muted" as const;
  };
  const statusColor = getStatusColor();

  function openInstaller(githubUrl = "") {
    setInstallerGithubUrl(githubUrl);
    setSettingsInstallerParam("plugins");
  }

  return (
    <>
      <SettingsPageLayout
        title="Plugins"
        description="Manage installed plugins. Click a plugin to configure its settings."
        statusText={`${enabledCount}/${plugins.length} plugins enabled`}
        statusColor={statusColor}
        searchPlaceholder="Search plugins..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        headerSlot={
          <SettingsPageToolbar
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => openInstaller()}
                uppercase={false}
                className="h-auto shrink-0 px-3 py-2 font-mono text-foreground-secondary text-w-sm uppercase tracking-wider hover:text-foreground"
              >
                Install from GitHub
              </Button>
            }
          />
        }
      >
        {filtered.length === 0 ? (
          <>
            <EmptyState
              message={searchQuery ? "No plugins match your search." : "No plugins installed."}
            />
            <CommunityExtensionDiscovery
              type="plugin"
              searchQuery={searchQuery}
              onInstall={openInstaller}
            />
          </>
        ) : (
          <>
            <SettingsGrid columns={3}>
              {filtered.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  enabled={!disabledIds.has(plugin.id)}
                  onToggle={() => handleToggle(plugin.id)}
                  onClick={() => setActivePluginId(plugin.id)}
                />
              ))}
            </SettingsGrid>
            <CommunityExtensionDiscovery
              type="plugin"
              searchQuery={searchQuery}
              onInstall={openInstaller}
            />
          </>
        )}
      </SettingsPageLayout>

      <InstallExtensionDialog
        open={installerOpen}
        initialGithubUrl={installerGithubUrl}
        onOpenChange={(open) => {
          if (!open) setInstallerGithubUrl("");
          setSettingsInstallerParam(open ? "plugins" : null);
        }}
      />

      {activePlugin ? (
        <PluginDetailModal
          plugin={activePlugin}
          open={!!activePluginId}
          onOpenChange={(o) => {
            if (!o) {
              setActivePluginId(null);
              setSettingsPluginTabParam(null);
            }
          }}
          enabled={!disabledIds.has(activePlugin.id)}
          onToggle={() => handleToggle(activePlugin.id)}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
    </>
  );
}
