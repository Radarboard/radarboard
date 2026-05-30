"use client";

import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { checkDependencies } from "@radarboard/integration-sdk/resolver";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import type { PluginUserConfig } from "@radarboard/plugin-sdk/types";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import {
  AlertCircle,
  Blocks,
  Cpu,
  Database,
  Fingerprint,
  Grid3X3,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Paintbrush,
  Plug,
  Search,
  Server,
  Settings,
} from "lucide-react";
import type React from "react";
import type { ComponentType } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShortcutKeys } from "./shortcut-keys";

// ---------------------------------------------------------------------------
// Unified command item type
// ---------------------------------------------------------------------------

type CommandCategory = "plugin" | "settings" | "action" | "catalog";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: CommandCategory;
  /** Keyboard shortcut hint shown on the right. */
  shortcut?: string;
  /** Names of missing required integrations (empty = all satisfied). */
  missingDeps?: string[];
}

// ---------------------------------------------------------------------------
// Settings section definitions
// ---------------------------------------------------------------------------

const SETTINGS_COMMANDS: CommandItem[] = [
  {
    id: "settings:projects",
    label: "Projects",
    description: "Manage projects and environments",
    icon: LayoutDashboard,
    category: "settings",
  },
  {
    id: "settings:widgets",
    label: "Widgets",
    description: "Configure dashboard widgets",
    icon: Grid3X3,
    category: "settings",
  },
  {
    id: "settings:layouts",
    label: "Layouts",
    description: "Customize grid layouts",
    icon: Layers,
    category: "settings",
  },
  {
    id: "settings:plugins",
    label: "Plugins",
    description: "Enable or disable plugins",
    icon: Blocks,
    category: "settings",
  },
  {
    id: "settings:integrations",
    label: "Integrations",
    description: "Connect external services",
    icon: Plug,
    category: "settings",
  },
  {
    id: "settings:mcp-servers",
    label: "MCP Servers",
    description: "Manage MCP server connections",
    icon: Server,
    category: "settings",
  },
  {
    id: "settings:ai",
    label: "Assistant",
    description: "Configure models, skills, prompts, and memory",
    icon: Cpu,
    category: "settings",
  },
  {
    id: "settings:appearance",
    label: "Appearance",
    description: "Theme, font scale, and display",
    icon: Paintbrush,
    category: "settings",
  },
  {
    id: "settings:database",
    label: "Database",
    description: "Database management and export",
    icon: Database,
    category: "settings",
  },
];

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

const ACTION_COMMANDS: CommandItem[] = [
  {
    id: "action:settings",
    label: "Open Settings",
    description: "Open the settings panel",
    icon: Settings,
    category: "action",
    shortcut: "⌘,",
  },
  {
    id: "action:chat",
    label: "Toggle Chat",
    description: "Open or close the AI chat drawer",
    icon: MessageSquare,
    category: "action",
    shortcut: "⌘⇧L",
  },
  {
    id: "action:knowledge",
    label: "Knowledge Health",
    description: "Review assistant memory coverage, staleness, and gaps",
    icon: Cpu,
    category: "action",
  },
  {
    id: "action:debug",
    label: "Debug",
    description: "Inspect traces, events, memory, and runtime diagnostics",
    icon: Fingerprint,
    category: "action",
  },
];

// ---------------------------------------------------------------------------
// Category labels for group headers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  plugin: "Plugins",
  settings: "Settings",
  catalog: "Extensions",
  action: "Actions",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  assistantEnabled: boolean;
  disabledPlugins?: Set<string>;
  pluginConfigs?: Map<string, PluginUserConfig>;
  searchShortcut?: string;
  settingsShortcut?: string;
  assistantShortcut?: string;
  onLaunch: (pluginId: string) => void;
  onOpenSettings: (section?: string) => void;
  onToggleChat?: () => void;
  onOpenKnowledge?: () => void;
  onOpenDebug?: () => void;
  /** Controlled open state — set by sidebar search button. */
  externalOpen?: boolean;
  /** Called when the palette closes itself (Escape, backdrop click, selection). */
  onOpenChange?: (open: boolean) => void;
}

function CommandPaletteInput({
  inputRef,
  query,
  onChange,
  onKeyDown,
  shortcutLabel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null> | ((node: HTMLInputElement | null) => void);
  query: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  shortcutLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 border-border border-b px-4 py-3">
      <Search className="icon-sm shrink-0 text-dim" />
      <Input
        ref={inputRef as React.RefObject<HTMLInputElement | null>}
        type="text"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search plugins, settings, actions..."
        className="h-auto flex-1 rounded-none border-none bg-transparent p-0 text-foreground focus-visible:ring-0"
      />
      <ShortcutKeys
        shortcut={shortcutLabel}
        className="hidden sm:inline-flex"
        keyClassName="bg-surface-raised text-dim"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginLauncher({
  assistantEnabled,
  disabledPlugins = new Set<string>(),
  pluginConfigs = new Map<string, PluginUserConfig>(),
  searchShortcut = "Mod+K",
  settingsShortcut = "Mod+,",
  assistantShortcut = "Mod+Shift+L",
  onLaunch,
  onOpenSettings,
  onToggleChat,
  onOpenKnowledge,
  onOpenDebug,
  externalOpen,
  onOpenChange,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resetPaletteState = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const attachInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (!node) return;
    requestAnimationFrame(() => {
      node.focus();
    });
  }, []);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(open) : next;
      if (!value) {
        resetPaletteState();
      }
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange, open, resetPaletteState]
  );

  // Build unified command list
  const allItems: CommandItem[] = useMemo(() => {
    const pluginItems: CommandItem[] = getAllPlugins()
      .filter((p) => !disabledPlugins.has(p.id))
      .map((p) => {
        const userConfig = pluginConfigs.get(p.id);
        const shortcut = userConfig?.shortcut ?? p.shortcut;
        const deps = p.requiredIntegrations?.length
          ? checkDependencies(p.requiredIntegrations as string[])
          : [];
        const missingDeps = deps.filter((d) => !d.installed).map((d) => d.integrationId);
        return {
          id: `plugin:${p.id}`,
          label: p.name,
          description: p.description,
          icon: p.icon,
          category: "plugin" as const,
          shortcut: shortcut ?? undefined,
          missingDeps: missingDeps.length > 0 ? missingDeps : undefined,
        };
      });

    // Catalog items: integrations + widgets (searchable but secondary)
    const catalogItems: CommandItem[] = [
      ...getAllIntegrations().map((d) => ({
        id: `catalog:integration:${d.id}`,
        label: d.name,
        description: `Integration — ${d.description}`,
        icon: d.icon,
        category: "catalog" as const,
      })),
      ...Array.from(WIDGET_REGISTRY.values()).map((d) => ({
        id: `catalog:widget:${d.id}`,
        label: d.name,
        description: `Widget — ${d.description}`,
        icon: LayoutDashboard,
        category: "catalog" as const,
      })),
    ];

    const settingsItems = assistantEnabled
      ? SETTINGS_COMMANDS
      : SETTINGS_COMMANDS.filter((item) => item.id !== "settings:ai");
    const actionItems = assistantEnabled
      ? ACTION_COMMANDS
      : ACTION_COMMANDS.filter(
          (item) => item.id !== "action:chat" && item.id !== "action:knowledge"
        );

    return [
      ...pluginItems,
      ...settingsItems,
      ...catalogItems,
      ...actionItems.map((item) => {
        if (item.id === "action:settings") {
          return { ...item, shortcut: settingsShortcut };
        }
        if (item.id === "action:chat") {
          return { ...item, shortcut: assistantShortcut };
        }
        return item;
      }),
    ];
  }, [assistantEnabled, assistantShortcut, disabledPlugins, pluginConfigs, settingsShortcut]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const lowerQuery = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery) ||
        item.id.toLowerCase().includes(lowerQuery)
    );
  }, [allItems, query]);

  // Group filtered results by category for visual separation
  const groups = useMemo(() => {
    const map = new Map<CommandCategory, CommandItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    // Maintain stable order: plugins, settings, catalog, actions
    const order: CommandCategory[] = ["plugin", "settings", "catalog", "action"];
    const result: { category: CommandCategory; items: CommandItem[] }[] = [];
    for (const cat of order) {
      const items = map.get(cat);
      if (items?.length) result.push({ category: cat, items });
    }
    return result;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      if (item.id.startsWith("plugin:")) {
        onLaunch(item.id.replace("plugin:", ""));
      } else if (item.id.startsWith("settings:")) {
        onOpenSettings(item.id.replace("settings:", ""));
      } else if (item.id === "action:settings") {
        onOpenSettings();
      } else if (item.id === "action:chat") {
        onToggleChat?.();
      } else if (item.id === "action:knowledge") {
        onOpenKnowledge?.();
      } else if (item.id === "action:debug") {
        onOpenDebug?.();
      } else if (item.id.startsWith("catalog:")) {
        const [, type] = item.id.split(":");
        onOpenSettings(type === "integration" ? "integrations" : "widgets");
      }
    },
    [onLaunch, onOpenDebug, onOpenKnowledge, onOpenSettings, onToggleChat, setOpen]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatItems[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [flatItems, selectedIndex, handleSelect, setOpen]
  );

  if (!open) return null;

  // Build a running index counter for the flat selection
  let runningIndex = 0;

  return createPortal(
    <div className="fixed inset-0 z-panel flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <Button
        variant="ghost"
        className="absolute inset-0 h-auto w-auto cursor-default rounded-none bg-background/60 p-0 backdrop-blur-sm hover:bg-background/60"
        onClick={() => setOpen(false)}
        aria-label="Close command palette"
        tabIndex={-1}
      />

      {/* Palette */}
      <div className="slide-in-from-top-2 fade-in relative mx-4 w-full max-w-2xl animate-in overflow-hidden rounded-card border border-border bg-background shadow-2xl duration-150">
        <CommandPaletteInput
          inputRef={attachInputRef}
          query={query}
          onChange={(value) => {
            setQuery(value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          shortcutLabel={searchShortcut}
        />

        {/* Results */}
        <div className="scrollbar-thin max-h-[400px] overflow-y-auto overflow-x-hidden">
          {flatItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-dim text-sm">No results found</div>
          ) : (
            groups.map((group) => {
              const groupItems = group.items.map((item) => {
                const idx = runningIndex++;
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "uppercase-none flex h-auto w-full items-center justify-start gap-3 rounded-none px-4 py-2.5 text-left font-sans transition-colors",
                      idx === selectedIndex ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <Icon className="icon-sm shrink-0 text-dim" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-foreground text-sm">
                        {item.label}
                        <span className="ml-2 text-dim text-xs">{item.description}</span>
                      </div>
                      {item.missingDeps && item.missingDeps.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-warning text-xs">
                          <AlertCircle className="h-3 w-3" />
                          <span>Requires {item.missingDeps.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    {Boolean(item.shortcut) && <ShortcutKeys shortcut={item.shortcut!} />}
                  </Button>
                );
              });

              return (
                <div key={group.category}>
                  <div className="px-4 pt-2 pb-1">
                    <span className="font-mono text-dim/60 text-w-sm uppercase tracking-wider">
                      {CATEGORY_LABELS[group.category]}
                    </span>
                  </div>
                  {groupItems}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-border border-t px-4 py-2 text-dim/60 text-w-sm">
          <span>
            <kbd className="mr-1 rounded-item border border-border bg-secondary px-1 py-0.5 font-mono text-foreground">
              ↑↓
            </kbd>
            navigate
            <kbd className="mx-1 rounded-item border border-border bg-secondary px-1 py-0.5 font-mono text-foreground">
              ↵
            </kbd>
            select
            <kbd className="mx-1 rounded-item border border-border bg-secondary px-1 py-0.5 font-mono text-foreground">
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
