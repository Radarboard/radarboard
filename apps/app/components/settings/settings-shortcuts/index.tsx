"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import type { AppShortcutActionId, ShortcutBindingConfig } from "@radarboard/types/shortcuts";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import { Switch } from "@radarboard/ui/switch";
import { cn } from "@radarboard/utils/cn";
import { formatShortcutLabel, resolveShortcutPlatform } from "@radarboard/utils/shortcut-label";
import { RotateCcw, Search, X } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { KeyboardEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePluginConfigs, useUpdatePluginConfig } from "@/hooks/plugins/use-plugin-configs";
import { isTauri } from "@/lib/platform";
import {
  detectShortcutConflicts,
  type ResolvedAppShortcutBinding,
  type ResolvedPluginShortcutBinding,
  resolveAppShortcutBindings,
  resolvePluginShortcutBinding,
} from "@/lib/shortcuts/registry";
import { SettingsSectionNav } from "../section-nav";
import { SettingsGrid, SettingsPageLayout } from "../settings-page-layout";
import type { SettingsSection } from "../settings-sections";

type ShortcutFilter = "app" | "plugins";
const SHORTCUT_FILTER_IDS = ["app", "plugins"] as const;
const DEFAULT_SHORTCUT_FILTER: ShortcutFilter = "app";
type ShortcutPlatform = ReturnType<typeof resolveShortcutPlatform>;

type ShortcutRow =
  | ({
      rowId: string;
      kind: "app";
      group: "app";
      actionId: AppShortcutActionId;
      defaultShortcut?: string;
    } & ResolvedAppShortcutBinding)
  | ({
      rowId: string;
      kind: "plugin";
      group: "plugins";
      defaultShortcut?: string;
      plugin: PluginDescriptor;
    } & ResolvedPluginShortcutBinding);

interface SettingsShortcutsProps {
  onOpenSettings: (section: SettingsSection) => void;
}

function keyboardEventToShortcut(event: KeyboardEvent<HTMLInputElement>): string | null {
  const ignoredKeys = new Set(["Meta", "Control", "Alt", "Shift"]);
  if (ignoredKeys.has(event.key)) return null;

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  let key = event.key;
  if (key === " ") key = "Space";
  if (key === "Esc") key = "Escape";
  if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join("+");
}

function shortcutLabel(
  value: string | null,
  platform: ReturnType<typeof resolveShortcutPlatform>
): string {
  return value ? formatShortcutLabel(value, platform) : "Unassigned";
}

function groupTitle(group: ShortcutRow["group"]): string {
  return group === "app" ? "App Shortcuts" : "Plugin Shortcuts";
}

function ShortcutRowCard({
  draftConflict,
  hasConflict,
  isDesktop,
  isRecording,
  onClear,
  onOpenPluginSettings,
  onRecordStart,
  onRecordingKeyDown,
  onReset,
  onSetDesktopGlobal,
  platform,
  recordingInputRef,
  row,
}: {
  draftConflict: string | null;
  hasConflict: boolean;
  isDesktop: boolean;
  isRecording: boolean;
  onClear: () => void;
  onOpenPluginSettings: () => void;
  onRecordStart: () => void;
  onRecordingKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onSetDesktopGlobal: (checked: boolean) => void;
  platform: ShortcutPlatform;
  recordingInputRef: RefObject<HTMLInputElement | null>;
  row: ShortcutRow;
}) {
  return (
    <div
      className={cn(
        "space-y-3 border border-border bg-surface p-3",
        hasConflict && "border-destructive/60"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium font-mono text-foreground text-w-base">{row.label}</div>
            {row.kind === "plugin" ? (
              <Badge className="bg-secondary text-dim">Plugin</Badge>
            ) : (
              <Badge className="bg-secondary text-dim">App</Badge>
            )}
            {"desktopOnly" in row && row.desktopOnly ? (
              <Badge className="bg-secondary text-dim">Desktop only</Badge>
            ) : null}
            {row.desktopGlobal ? <Badge className="bg-secondary text-dim">Global</Badge> : null}
            {hasConflict ? (
              <Badge className="bg-destructive text-destructive-foreground">Conflict</Badge>
            ) : null}
          </div>
          <div className="text-muted-foreground text-w-sm">{row.description}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRecording ? (
            <Input
              ref={recordingInputRef}
              readOnly
              value=""
              placeholder="Press shortcut"
              className="h-8 w-[170px] font-mono text-w-sm"
              onKeyDown={onRecordingKeyDown}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              uppercase={false}
              onClick={onRecordStart}
              className="h-8 min-w-[170px] justify-between rounded-none px-3 font-mono text-w-sm"
            >
              <span>{shortcutLabel(row.shortcut, platform)}</span>
              <Search className="icon-xs" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            uppercase={false}
            onClick={onReset}
            className="h-8 rounded-none px-2 text-dim hover:text-foreground-secondary"
            aria-label={`Reset ${row.label}`}
          >
            <RotateCcw className="icon-xs" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            uppercase={false}
            onClick={onClear}
            className="h-8 rounded-none px-2 text-dim hover:text-foreground-secondary"
            aria-label={`Clear ${row.label}`}
          >
            <X className="icon-xs" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-3">
        <div className="flex flex-wrap items-center gap-2 text-dim text-w-sm">
          <span>Default: {shortcutLabel(row.defaultShortcut ?? null, platform)}</span>
          {row.kind === "plugin" ? (
            <Button
              type="button"
              variant="ghost-link"
              uppercase={false}
              onClick={onOpenPluginSettings}
              className="h-auto p-0 text-dim hover:text-foreground-secondary"
            >
              Open plugin settings
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-dim text-w-sm">Desktop global</span>
          <Switch
            checked={row.desktopGlobal}
            disabled={!row.desktopGlobalCapable || !isDesktop}
            onCheckedChange={onSetDesktopGlobal}
            aria-label={`${row.label} desktop global`}
          />
        </div>
      </div>

      {isRecording ? (
        <div className={cn("font-mono text-w-sm", draftConflict ? "text-destructive" : "text-dim")}>
          {draftConflict ?? "Press a shortcut. Esc cancels. Delete clears."}
        </div>
      ) : null}
      {!isDesktop && row.desktopGlobalCapable ? (
        <div className="font-mono text-dim text-w-sm">
          Desktop global shortcuts are available in the Radarboard desktop app only.
        </div>
      ) : null}
    </div>
  );
}

export function SettingsShortcuts({ onOpenSettings }: SettingsShortcutsProps) {
  const { preferences, updatePreferences } = useDashboard();
  const pluginConfigs = usePluginConfigs();
  const updatePluginConfig = useUpdatePluginConfig();
  const [filterParam, setFilterParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.shortcutScope,
    parseAsStringLiteral(SHORTCUT_FILTER_IDS)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<string | null>(null);
  const recordingInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = isTauri();
  const platform = useMemo(() => resolveShortcutPlatform(), []);
  const filter = filterParam ?? DEFAULT_SHORTCUT_FILTER;

  useEffect(() => {
    if (filterParam === filter) return;
    setFilterParam(filter);
  }, [filter, filterParam, setFilterParam]);

  useEffect(() => {
    if (!recordingId) return;
    recordingInputRef.current?.focus();
  }, [recordingId]);

  const appRows = useMemo<ShortcutRow[]>(
    () =>
      resolveAppShortcutBindings(preferences.shortcuts).map((binding) => ({
        ...binding,
        rowId: `app:${binding.id}`,
        kind: "app" as const,
        group: "app" as const,
        actionId: binding.id,
        defaultShortcut: binding.defaultShortcut,
      })),
    [preferences.shortcuts]
  );

  const pluginRows = useMemo<ShortcutRow[]>(
    () =>
      getAllPlugins().map((plugin) => {
        const config = pluginConfigs.get(plugin.id);
        const binding = resolvePluginShortcutBinding(plugin, config);
        return {
          ...binding,
          rowId: `plugin:${plugin.id}`,
          kind: "plugin" as const,
          group: "plugins" as const,
          plugin,
          defaultShortcut: plugin.shortcut,
        };
      }),
    [pluginConfigs]
  );

  const allRows = useMemo(() => [...appRows, ...pluginRows], [appRows, pluginRows]);
  const conflicts = useMemo(
    () =>
      detectShortcutConflicts(allRows.map((row) => ({ id: row.rowId, shortcut: row.shortcut }))),
    [allRows]
  );
  const conflictMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const conflict of conflicts) {
      for (const id of conflict.actionIds) {
        map.set(id, conflict.shortcut);
      }
    }
    return map;
  }, [conflicts]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allRows.filter((row) => {
      if (filter === "app" && row.kind !== "app") return false;
      if (filter === "plugins" && row.kind !== "plugin") return false;
      if (!query) return true;
      const sourceText = row.kind === "plugin" ? row.pluginId : row.actionId;
      return (
        row.label.toLowerCase().includes(query) ||
        row.description.toLowerCase().includes(query) ||
        sourceText.toLowerCase().includes(query)
      );
    });
  }, [allRows, filter, searchQuery]);

  const groupedRows = useMemo(
    () => ({
      app: filteredRows.filter((row) => row.group === "app"),
      plugins: filteredRows.filter((row) => row.group === "plugins"),
    }),
    [filteredRows]
  );

  const summary = useMemo(() => {
    const bound = allRows.filter((row) => row.shortcut != null).length;
    const custom = allRows.filter((row) => {
      if (row.kind === "app") {
        return preferences.shortcuts?.[row.actionId]?.shortcut !== undefined;
      }
      return pluginConfigs.get(row.pluginId)?.shortcut !== undefined;
    }).length;
    const global = allRows.filter((row) => row.desktopGlobal).length;
    return { total: allRows.length, bound, custom, global, conflicts: conflicts.length };
  }, [allRows, conflicts.length, pluginConfigs, preferences.shortcuts]);

  const updateAppBinding = (
    actionId: AppShortcutActionId,
    updater: (prev: ShortcutBindingConfig | undefined) => ShortcutBindingConfig | undefined
  ) => {
    const current = preferences.shortcuts ?? {};
    const nextValue = updater(current[actionId]);
    const nextShortcuts = { ...current };
    if (nextValue === undefined) delete nextShortcuts[actionId];
    else nextShortcuts[actionId] = nextValue;
    updatePreferences({ shortcuts: nextShortcuts });
  };

  const persistShortcut = (row: ShortcutRow, shortcut: string | null) => {
    const nextRows = allRows.map((item) =>
      item.rowId === row.rowId ? { ...item, shortcut } : item
    );
    const nextConflicts = detectShortcutConflicts(
      nextRows.map((item) => ({ id: item.rowId, shortcut: item.shortcut }))
    );
    const currentConflict = nextConflicts.find((conflict) =>
      conflict.actionIds.includes(row.rowId)
    );
    if (currentConflict) {
      const conflictingLabels = currentConflict.actionIds
        .filter((id) => id !== row.rowId)
        .map((id) => nextRows.find((item) => item.rowId === id)?.label ?? id);
      setDraftConflict(`Conflicts with ${conflictingLabels.join(", ")}`);
      return;
    }

    setDraftConflict(null);
    setRecordingId(null);

    if (row.kind === "app") {
      updateAppBinding(row.actionId, (prev) => ({
        ...(prev ?? {}),
        shortcut,
      }));
      return;
    }

    updatePluginConfig(row.pluginId, (prev) => ({
      ...prev,
      shortcut,
    }));
  };

  const resetRow = (row: ShortcutRow) => {
    if (row.kind === "app") {
      updateAppBinding(row.actionId, () => undefined);
      return;
    }

    updatePluginConfig(row.pluginId, (prev) => ({
      ...prev,
      shortcut: undefined,
      desktopGlobalShortcut: undefined,
    }));
  };

  const setDesktopGlobal = (row: ShortcutRow, checked: boolean) => {
    if (row.kind === "app") {
      updateAppBinding(row.actionId, (prev) => ({
        ...(prev ?? {}),
        desktopGlobal: checked,
      }));
      return;
    }

    updatePluginConfig(row.pluginId, (prev) => ({
      ...prev,
      desktopGlobalShortcut: checked,
    }));
  };

  const renderRow = (row: ShortcutRow) => {
    const isRecording = recordingId === row.rowId;
    const hasConflict = conflictMap.has(row.rowId);
    return (
      <ShortcutRowCard
        key={row.rowId}
        draftConflict={draftConflict}
        hasConflict={hasConflict}
        isDesktop={isDesktop}
        isRecording={isRecording}
        onClear={() => persistShortcut(row, null)}
        onOpenPluginSettings={() => onOpenSettings("plugins")}
        onRecordStart={() => {
          setDraftConflict(null);
          setRecordingId(row.rowId);
        }}
        onRecordingKeyDown={(event) => {
          event.preventDefault();
          if (event.key === "Escape") {
            setDraftConflict(null);
            setRecordingId(null);
            return;
          }
          if (event.key === "Backspace" || event.key === "Delete") {
            persistShortcut(row, null);
            return;
          }
          const shortcut = keyboardEventToShortcut(event);
          if (!shortcut) return;
          persistShortcut(row, shortcut);
        }}
        onReset={() => resetRow(row)}
        onSetDesktopGlobal={(checked) => setDesktopGlobal(row, checked)}
        platform={platform}
        recordingInputRef={recordingInputRef}
        row={row}
      />
    );
  };

  return (
    <SettingsPageLayout
      title="Shortcuts"
      description="Manage core app shortcuts and plugin launch shortcuts in one place."
      statusText={`${summary.bound}/${summary.total} bound · ${summary.conflicts} conflicts`}
      statusColor={summary.conflicts > 0 ? "yellow" : "muted"}
      searchPlaceholder="Search shortcuts..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      headerSlot={
        <SettingsSectionNav
          items={[
            { id: "app", label: "App" },
            { id: "plugins", label: "Plugins" },
          ]}
          activeId={filter}
          onChange={(value) => {
            if (value) setFilterParam(value as ShortcutFilter);
          }}
        />
      }
    >
      <SettingsGrid columns={3}>
        <div className="space-y-2 border border-border bg-surface p-4">
          <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Bound</div>
          <div className="text-foreground text-w-xl">{summary.bound}</div>
        </div>
        <div className="space-y-2 border border-border bg-surface p-4">
          <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Custom</div>
          <div className="text-foreground text-w-xl">{summary.custom}</div>
        </div>
        <div className="space-y-2 border border-border bg-surface p-4">
          <div className="font-mono text-dim text-w-sm uppercase tracking-wider">Global</div>
          <div className="text-foreground text-w-xl">{summary.global}</div>
        </div>
      </SettingsGrid>

      {filteredRows.length === 0 ? (
        <EmptyState message="No shortcuts match your search." />
      ) : (
        <div className="space-y-5">
          {filter === "app" && groupedRows.app.length > 0 ? (
            <section className="space-y-3">
              <div className="font-mono text-foreground-secondary text-w-sm uppercase tracking-widest">
                {groupTitle("app")}
              </div>
              <div className="space-y-3">{groupedRows.app.map(renderRow)}</div>
            </section>
          ) : null}

          {filter === "plugins" && groupedRows.plugins.length > 0 ? (
            <section className="space-y-3">
              <div className="font-mono text-foreground-secondary text-w-sm uppercase tracking-widest">
                {groupTitle("plugins")}
              </div>
              <div className="space-y-3">{groupedRows.plugins.map(renderRow)}</div>
            </section>
          ) : null}
        </div>
      )}
    </SettingsPageLayout>
  );
}
