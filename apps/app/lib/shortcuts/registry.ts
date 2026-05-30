"use client";

import type { PluginDescriptor, PluginUserConfig } from "@radarboard/plugin-sdk/types";
import type {
  AppShortcutActionId,
  AppShortcutPreferencesConfig,
} from "@radarboard/types/shortcuts";

export interface AppShortcutDefinition {
  id: AppShortcutActionId;
  label: string;
  description: string;
  defaultShortcut?: string;
  desktopOnly?: boolean;
  desktopGlobalCapable?: boolean;
  desktopGlobalDefault?: boolean;
}

export interface ResolvedAppShortcutBinding extends AppShortcutDefinition {
  shortcut: string | null;
  desktopGlobal: boolean;
}

export interface ResolvedPluginShortcutBinding {
  id: string;
  pluginId: string;
  label: string;
  description: string;
  shortcut: string | null;
  desktopGlobal: boolean;
  desktopGlobalCapable: boolean;
}

export interface ShortcutConflict {
  shortcut: string;
  actionIds: string[];
}

export const APP_SHORTCUT_DEFINITIONS: AppShortcutDefinition[] = [
  {
    id: "search",
    label: "Search",
    description: "Open the command palette",
    defaultShortcut: "Mod+K",
    desktopGlobalCapable: true,
  },
  {
    id: "open-settings",
    label: "Settings",
    description: "Open the settings dialog",
    defaultShortcut: "Mod+,",
    desktopGlobalCapable: true,
  },
  {
    id: "assistant",
    label: "Assistant",
    description: "Open or close the assistant drawer",
    defaultShortcut: "Mod+Shift+L",
    desktopGlobalCapable: true,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Open the notifications dropdown",
    defaultShortcut: "Mod+Shift+N",
    desktopGlobalCapable: true,
    desktopGlobalDefault: true,
  },
  {
    id: "edit-layout",
    label: "Edit Layout",
    description: "Toggle dashboard layout editing",
    defaultShortcut: "Mod+Shift+M",
  },
  {
    id: "show-focus-window",
    label: "Show Radarboard",
    description: "Show and focus the Radarboard desktop window",
    defaultShortcut: "Mod+Shift+D",
    desktopOnly: true,
    desktopGlobalCapable: true,
    desktopGlobalDefault: true,
  },
];

export function getAppShortcutDefinition(
  actionId: AppShortcutActionId
): AppShortcutDefinition | undefined {
  return APP_SHORTCUT_DEFINITIONS.find((definition) => definition.id === actionId);
}

export function normalizeShortcutInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeShortcutKey(value: string | null | undefined): string | null {
  const normalized = normalizeShortcutInput(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function resolveAppShortcutBindings(
  preferences: AppShortcutPreferencesConfig | undefined
): ResolvedAppShortcutBinding[] {
  return APP_SHORTCUT_DEFINITIONS.map((definition) => {
    const override = preferences?.[definition.id];
    const shortcut =
      override && "shortcut" in override
        ? normalizeShortcutInput(override.shortcut)
        : normalizeShortcutInput(definition.defaultShortcut);
    return {
      ...definition,
      shortcut,
      desktopGlobal:
        definition.desktopGlobalCapable === true
          ? (override?.desktopGlobal ?? definition.desktopGlobalDefault ?? false)
          : false,
    };
  });
}

export function resolvePluginShortcutBinding(
  plugin: PluginDescriptor,
  config: PluginUserConfig | undefined
): ResolvedPluginShortcutBinding {
  const shortcut =
    config && "shortcut" in config
      ? normalizeShortcutInput(config.shortcut)
      : normalizeShortcutInput(plugin.shortcut);
  return {
    id: `plugin:${plugin.id}`,
    pluginId: plugin.id,
    label: plugin.name,
    description: plugin.description,
    shortcut,
    desktopGlobal: config?.desktopGlobalShortcut ?? false,
    desktopGlobalCapable: true,
  };
}

export function detectShortcutConflicts(
  bindings: Array<{ id: string; shortcut: string | null }>
): ShortcutConflict[] {
  const map = new Map<string, string[]>();

  for (const binding of bindings) {
    const key = normalizeShortcutKey(binding.shortcut);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(binding.id);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .filter(([, actionIds]) => actionIds.length > 1)
    .map(([shortcut, actionIds]) => ({ shortcut, actionIds }));
}

export function toTauriShortcut(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "Mod") return "CmdOrCtrl";
      return part;
    })
    .join("+");
}
